// FidgetTrack native shell: one full-screen WebView holding the offline app,
// bridged to iOS local notifications for due-back reminders. All data lives in the
// WebView's IndexedDB; nothing leaves the device.
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { planReminders } from './src/reminders';

const page = require('./src/page.js') as string;
const BG = '#f4f5fb';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function hasPermission(): Promise<boolean> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export default function App() {
  const ref = useRef<WebView>(null);
  const toWeb = (msg: object) =>
    ref.current?.injectJavaScript(`window.__ftNative&&window.__ftNative(${JSON.stringify(msg)});true;`);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const fid = (resp.notification.request.content.data as { fidgetId?: string })?.fidgetId;
      if (fid) toWeb({ type: 'openFidget', fidgetId: fid });
    });
    return () => sub.remove();
  }, []);

  // Replace every pending fidget reminder with a fresh plan (idempotent).
  async function reconcile(fidgets: unknown[], people: unknown[], loans: unknown[]) {
    try {
      if (!(await hasPermission())) return;
      const plan = planReminders(fidgets as never, people as never, loans as never, Date.now());
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        pending
          .filter((n) => n.identifier.startsWith('fidget-'))
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );
      for (const r of plan) {
        await Notifications.scheduleNotificationAsync({
          identifier: r.id,
          content: { title: r.title, body: r.body, sound: true, data: { fidgetId: r.fidgetId } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.when) },
        });
      }
    } catch {
      /* notifications are best-effort */
    }
  }

  async function onMessage(e: WebViewMessageEvent) {
    let msg: { type?: string; [k: string]: unknown };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'reminders') {
      reconcile((msg.fidgets as unknown[]) || [], (msg.people as unknown[]) || [], (msg.loans as unknown[]) || []);
    } else if (msg.type === 'requestNotifications') {
      await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: true } });
      toWeb({ type: 'notifState', granted: await hasPermission() });
    } else if (msg.type === 'notifQuery') {
      toWeb({ type: 'notifState', granted: await hasPermission() });
    } else if (msg.type === 'remindNow') {
      if (await hasPermission()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: (msg.title as string) || 'FidgetTrack',
            body: (msg.body as string) || '',
            sound: true,
            data: { fidgetId: msg.fidgetId },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
        });
      }
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="auto" />
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html: page, baseUrl: 'https://fidgettrack.local/' }}
        onMessage={onMessage}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        allowFileAccess
        onContentProcessDidTerminate={() => ref.current?.reload()}
        onShouldStartLoadWithRequest={(r) =>
          r.url.startsWith('https://fidgettrack.local') ||
          r.url.startsWith('about:') ||
          r.url.startsWith('blob:') ||
          r.url.startsWith('data:')
        }
        overScrollMode="never"
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        keyboardDisplayRequiresUserAction={false}
        setSupportMultipleWindows={false}
        domStorageEnabled
        javaScriptEnabled
        style={{ flex: 1, backgroundColor: BG }}
      />
    </View>
  );
}
