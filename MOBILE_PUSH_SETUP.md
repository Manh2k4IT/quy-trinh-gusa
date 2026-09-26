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

Install Android Studio and a supported JDK, then run:

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