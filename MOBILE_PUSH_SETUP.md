# Mobile Push Setup

The mobile app uses Capacitor with Firebase Cloud Messaging (FCM). Android and iOS receive OS-managed push notifications, so delivery does not depend on an open page or a JavaScript process running in the background. The app still needs network access, and users must allow notifications. Android force-stop and iOS Focus/notification settings can suppress delivery or sound.

## Firebase and Render

1. Create a Firebase project and register an Android app with package ID `vn.gusa.quytrinh.mobile` and an iOS app with bundle ID `vn.gusa.quytrinh.mobile`.
2. Enable **Authentication → Google** in Firebase. Add the Android debug/release and Google Play signing SHA-1/SHA-256 fingerprints.
3. Download `google-services.json` to `android/app/google-services.json` and `GoogleService-Info.plist` to `ios/App/App/GoogleService-Info.plist`. These files are git-ignored. Keep the existing Render `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for web OAuth; mobile Google sign-in uses a Firebase ID token verified by Firebase Admin.
4. In Xcode, add the `REVERSED_CLIENT_ID` value from `GoogleService-Info.plist` as a URL Type so native Google Sign-In can return to the app.
5. In Firebase project settings, upload an Apple APNs authentication key and enable Push Notifications for the iOS app.
6. Create a Firebase service account with permission to verify Firebase Auth tokens and send FCM messages. Add its JSON contents as the Render environment variable `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit this service-account key or send it in chat.
7. Confirm Render has persistent disk mounted at `/var/data`; device tokens are stored in `/var/data/push-devices.json`.

## Android

Install Android Studio and JDK 21 (required by Capacitor 8), then run:

```powershell
npm run mobile:sync
npx cap open android
```

Build and sign the APK/AAB in Android Studio. The two WAV voice files are copied into Android `res/raw` and assigned to separate approval/rejection notification channels. Android users can change each channel's sound in system settings.

## iPhone

On a Mac with Xcode installed, run:

```sh
npm run mobile:sync
npx cap open ios
```

Enable the **Push Notifications** capability in Xcode and verify the APNs key is connected in Firebase. The `proposal_approved.wav` and `proposal_rejected.wav` PCM files are included in the App target's **Copy Bundle Resources**. Custom sounds are under 30 seconds; iOS mute/Focus settings can still silence them. Sign and distribute through an Apple developer team.

## Backend behavior

The app requests push permission after a user signs in, then registers its FCM token against that authenticated account. When a manager approves or rejects a proposal, the server sends a targeted push to that proposal owner's registered devices. The push contains an OS notification and the corresponding bundled voice sound. The existing in-app voice continues to play while the page is active.

The Capacitor shell loads the production HTTPS site for the existing UI. Google Sign-In is native through Firebase, then Render verifies the Firebase ID token and issues the existing Gusa session cookie; desktop/browser OAuth remains unchanged. This is suitable for an internal pilot; App Store distribution should be reviewed for the remote-content policy and may require bundling the web frontend.

## iPhone web push

Web push requires a successfully registered service worker and enabling the Web Push switch in Gusa settings, not just granting notification permission in Chrome/Android. The server injects only the public Firebase web configuration into the classic bundled worker response so Firebase push listeners register synchronously at startup; do not serve the worker bundle from a static host without this configuration. Build it with `npm run mobile:build`. If initialization fails, Gusa settings show the error. Android must also allow Chrome notifications and background activity; installing a website shortcut alone does not subscribe the device.

The website can send lock-screen notifications without installing an App Store app. iPhone users need iOS 16.4 or newer, must add the site to their Home Screen from Safari, open Gusa from that Home Screen icon, sign in, and allow notifications. An ordinary Safari tab cannot subscribe to web push on iPhone.

1. In the existing Firebase project, register a **Web app** and copy its Firebase web configuration.
2. In Firebase Console, open **Project settings → Cloud Messaging → Web configuration**, generate/import a Web Push certificate key pair, and copy its public VAPID key.
3. Add these values to the server environment (for Render, use the service's Environment settings). These are public Firebase client settings, not service-account credentials:
   - `FIREBASE_WEB_API_KEY`
   - `FIREBASE_WEB_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_WEB_APP_ID`
   - `FIREBASE_WEB_VAPID_KEY`
4. Keep `FIREBASE_SERVICE_ACCOUNT_JSON` configured on the server and persistent storage enabled for `push-devices.json`.
5. Run `npm run mobile:build` before deploying so it creates the browser bundle and Firebase service worker. Deploy the application, then verify `/manifest.webmanifest`, `/web-push.bundle.js`, and `/firebase-messaging-sw.js` are served over HTTPS.

After deployment, signed-in web users on supported browsers can enable or disable **Thông báo khi chạy nền** in **Cài đặt**. There is no floating permission button on other pages. The server stores the browser's FCM token against the authenticated account and sends proposal notifications through the same Firebase project. Logging out removes that browser token. On iPhone, settings explain how to add Gusa to the Home Screen when opened in a normal Safari tab. Desktop and Capacitor apps keep their native notification mechanisms and do not register Web Push.