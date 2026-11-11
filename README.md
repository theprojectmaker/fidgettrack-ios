# FidgetTrack (native)

An offline iOS app for tracking who borrowed your 3D-printed fidgets. It wraps the
self-contained offline web app (`tests/fidgettrack`) in a single full-screen Expo WebView,
so it keeps the photo library, people, lending log, and the **camera scan-to-identify**
feature (perceptual hashing) — all stored on-device in IndexedDB, no network, ever.

The one thing that gets *better* natively: due-back **reminders** are real iOS local
notifications (`expo-notifications`), scheduled at each fidget's due time and fired even
when the app is closed — no server, still fully offline.

## Layout
- `web/index.html` — the actual app (identical to the `tests/fidgettrack` PWA).
- `tools/build-native.mjs` — injects the native bridge and emits `src/page.js` (committed).
- `src/page.js` — the app as a string the WebView loads (generated; don't edit by hand).
- `App.tsx` — the WebView shell + the notification bridge.
- `src/reminders.ts` — pure reminder-planning logic (unit-tested in `tests/`).
- `.github/workflows/ios-testflight.yml` — free GitHub macOS build → TestFlight.

## Bridge (web ⇄ native)
- Web → native: `reminders` (snapshot to schedule), `requestNotifications`, `notifQuery`, `remindNow`.
- Native → web: `notifState` (permission), `openFidget` (tapped a reminder).

## Commands
```
npm run build:web   # regenerate src/page.js after editing web/index.html
npm test            # reminder-planner tests
npm run validate    # check every Expo module is the same SDK (CI gate)
npm run icons       # regenerate app + notification icons
```

See `SHIP.md` for the TestFlight steps.
