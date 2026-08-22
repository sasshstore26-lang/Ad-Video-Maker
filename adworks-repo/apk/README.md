# Adworks — APK build (route 1: WebView wrapper)

This wraps the design prototype in a native Android WebView with Capacitor and produces an
installable APK. It is a **demo build** — good for putting the flow on a real phone and handing it
around. It is not a production app: there is no video pipeline, no backend, no store-ready release
signing. For that, see `design_handoff_ad_studio/` and rebuild natively.

## What is here

| Path | What it is |
| --- | --- |
| `www/index.html` | the whole app as one self-contained offline file (no network needed) |
| `src/AdworksApp.dc.html` | the source: prototype with the device bezel and designer sidebar removed, pinned full-viewport with safe-area padding |
| `src/_ds`, `src/assets`, `src/support.js` | design system, product footage, runtime that the source loads |
| `package.json`, `capacitor.config.json` | the Capacitor project |

App id `com.adworks.adstudio`, app name **Adworks**.

## Build it (on your machine)

Prerequisites: Node 18+, JDK 17, Android Studio with the Android SDK and platform-tools.

```bash
cd apk
npm install
npx cap add android          # creates the android/ native project
npx cap sync android         # copies www/ into it
cd android && ./gradlew assembleDebug
```

The APK lands at:

```
apk/android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected phone with `adb install -r app-debug.apk`, or just email/AirDrop the file and
open it (the phone will ask you to allow installing from unknown sources).

To change the design and rebuild: edit `src/AdworksApp.dc.html`, re-bundle it to `www/index.html`,
then `npx cap sync android` and re-run the gradle task.

## Release build (optional)

```bash
keytool -genkey -v -keystore adworks.keystore -alias adworks -keyalg RSA -keysize 2048 -validity 10000
cd android && ./gradlew assembleRelease     # after wiring the keystore into android/app/build.gradle
```

Play Store wants an AAB rather than an APK: `./gradlew bundleRelease`.

## Known limits of this build

- **No video.** Each scene shows a still. Real playback needs ExoPlayer/Media3 behind a native player.
- **WebView gestures.** Keyframe and trim drags use pointer events; they work, but they do not feel
  native. This is the main reason route 1 is a demo, not a product.
- **No AI, no accounts.** Generation, voices, renders, ad-platform connections and analytics are all
  simulated in the page. In a real app they are server calls.
- **Portrait only in practice** — the layout is designed at 402×874 and is not laid out for landscape
  or tablets.
- Icons are CSS shapes where an icon was not needed for meaning; a real build should use Lucide at
  stroke-width 1.5.

## Sanity check before you build

Open `www/index.html` in Chrome, switch DevTools to a phone viewport (402×874) and walk the flow —
home → create → generate → editor → export → publish → analytics. What you see there is exactly what
the APK will show.
