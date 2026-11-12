// FidgetTrack native shell: one full-screen WebView holding the offline app, bridged to iOS
// local notifications for due-back reminders. All data lives in the WebView's IndexedDB;
// nothing leaves the device.
import React, { useEffect, useRef } from 'react';
import { useColorScheme, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { planReminders } from './src/reminders';

const page = require('./src/page.js') as string;

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

type Snapshot = { enabled?: boolean; leadMin?: number; fidgets?: unknown[]; people?: unknown[]; loans?: unknown[] };

// Make the iOS notification queue match the snapshot: drop stale fidget reminders, (re)schedule the plan.
async function reconcile(s: Snapshot) {
  try {
    const pending = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.identifier.startsWith('fidget-'));
    const plan = s.enabled && (await hasPermission())
      ? planReminders((s.fidgets || []) as never, (s.people || []) as never, (s.loans || []) as never, Date.now(), s.leadMin || 0)
      : [];
    const keep = new Set(plan.map((r) => r.id));
    await Promise.all(pending.filter((n) => !keep.has(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, sound: true, data: { fidgetId: r.fidgetId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.when) },
      });
    }
  } catch {
    /* reminders are best-effort */
  }
}

export default function App() {
  const ref = useRef<WebView>(null);
  const ready = useRef(false);
  const pendingOpen = useRef<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#0e0e10' : '#f2f2f7';

  const toWeb = (msg: object) => ref.current?.injectJavaScript(`window.__ftNative&&window.__ftNative(${JSON.stringify(msg)});true;`);
  const openFidget = (id?: string) => {
    if (!id) return;
    if (ready.current) toWeb({ type: 'openFidget', fidgetId: id });
    else pendingOpen.current = id; // app was launched by tapping a reminder; open it once the page is up
  };

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((r) => {
      const id = (r?.notification.request.content.data as { fidgetId?: string } | undefined)?.fidgetId;
      if (id && !ready.current) pendingOpen.current = id;
    });
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      openFidget((r.notification.request.content.data as { fidgetId?: string } | undefined)?.fidgetId),
    );
    return () => sub.remove();
  }, []);

  async function onMessage(e: WebViewMessageEvent) {
    let msg: { type?: string } & Snapshot;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'reminders') {
      queue.current = queue.current.then(() => reconcile(msg));
    } else if (msg.type === 'requestNotifications') {
      await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
      toWeb({ type: 'notifState', granted: await hasPermission() });
    } else if (msg.type === 'notifQuery') {
      ready.current = true;
      toWeb({ type: 'notifState', granted: await hasPermission() });
      if (pendingOpen.current) {
        const id = pendingOpen.current;
        pendingOpen.current = null;
        setTimeout(() => toWeb({ type: 'openFidget', fidgetId: id }), 400);
      }
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html: page, baseUrl: 'https://fidgettrack.local/' }}
        injectedJavaScriptBeforeContentLoaded="window.__FT_NATIVE=true;true;"
        onMessage={onMessage}
        onContentProcessDidTerminate={() => {
          ready.current = false;
          ref.current?.reload();
        }}
        onShouldStartLoadWithRequest={(r) =>
          r.url.startsWith('https://fidgettrack.local') || r.url.startsWith('about:') || r.url.startsWith('blob:') || r.url.startsWith('data:')
        }
        allowsInlineMediaPlayback
        bounces={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        keyboardDisplayRequiresUserAction={false}
        setSupportMultipleWindows={false}
        domStorageEnabled
        javaScriptEnabled
        style={{ flex: 1, backgroundColor: bg }}
      />
    </View>
  );
}
