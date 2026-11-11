# Getting FidgetTrack onto TestFlight

Everything is wired for your usual **free GitHub Actions → TestFlight** pipeline. Use a
**PUBLIC** repo (private macOS builds are blocked by the billing issue).

Target: repo `theprojectmaker/fidgettrack-ios` (PUBLIC), bundle `com.solyapps.fidgettrack`,
EAS slug `fidgettrack`, owner `solomonsasson`.

The steps that need your Apple ID can only be done by you — nobody else should type Apple
credentials. Do them once; after that GitHub builds every release for free.

1. `cd fidgettrack-native && npm install` (already done once by the build).
2. `npx eas-cli@latest login`, then `npx eas-cli@latest init` — creates the EAS project and
   writes `extra.eas.projectId` into `app.json`.
3. `npx eas-cli@latest credentials -p ios` → sign in with your Apple ID when asked. This
   creates the certificate + provisioning profile for `com.solyapps.fidgettrack`.
   (No build is needed for this — the `eas credentials` path is enough.)
4. Create the repo and push:
   ```
   git init && git add -A && git commit -m "FidgetTrack native (offline PWA in a WebView)"
   gh repo create theprojectmaker/fidgettrack-ios --public --source=. --remote=origin --push
   ```
5. Add the EXPO_TOKEN secret (expo.dev → Account settings → Access tokens):
   ```
   gh secret set EXPO_TOKEN -R theprojectmaker/fidgettrack-ios
   ```
   (or reuse the `tests/set-expo-token.ps1` pattern from the other apps.)
6. First build with submit OFF, then grab the `.ipa` artifact:
   ```
   gh workflow run ios-testflight.yml -R theprojectmaker/fidgettrack-ios -f submit=false
   ```
7. Create the App Store Connect app, once, interactively:
   ```
   npx eas-cli@latest submit -p ios --path <downloaded app.ipa>
   ```
   Put the printed **ascAppId** into `eas.json` → `submit.production.ios.ascAppId`, commit, push.
8. From then on, build + ship to TestFlight in one click:
   ```
   gh workflow run ios-testflight.yml -R theprojectmaker/fidgettrack-ios -f submit=true
   ```

## Changing the app later
The whole UI lives in `web/index.html` (the same offline PWA as `tests/fidgettrack`). After
editing it, regenerate the bundled copy and commit:
```
npm run build:web      # rewrites src/page.js from web/index.html
npm test               # reminder-planner tests
```
Bump `app.json` `version` for a new TestFlight build.
