# Android — post-`cap add android` manifest edits

`npx cap add android` generates `android/app/src/main/AndroidManifest.xml`
from Capacitor's template. It doesn't exist until you run that command,
so these edits can't be pre-applied — apply them once it's generated.

## 1. Permissions
Add inside `<manifest>`, above `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET" /> <!-- already present by default -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" /> <!-- required on Android 13+ for push -->
```

## 2. Deep links (universal-link style)
Inside `<activity android:name=".MainActivity" ...>`, add a second intent-filter alongside the existing launcher one:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="your-app.vercel.app" />
</intent-filter>
```
Replace `your-app.vercel.app` with your real production domain (same one as `CAPACITOR_SERVER_URL`). `android:autoVerify="true"` requires hosting a Digital Asset Links file at `https://your-app.vercel.app/.well-known/assetlinks.json` — see https://developer.android.com/training/app-links/verify-android-applinks for the exact JSON format (needs your release keystore's SHA-256 fingerprint).

## 3. Edge-to-edge / Android 13-14
Capacitor 6's default template already sets `android:theme` appropriately and targets `compileSdk`/`targetSdk` 34. No manual change needed beyond what `bootstrap.ts` already does at runtime (`StatusBar.setOverlaysWebView`).

## 4. FCM (only once you add native push relay per MOBILE_BUILD_REPORT.md §7)
Place the `google-services.json` you download from Firebase into `android/app/`, then add to `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'
```
and to `android/build.gradle`'s `dependencies`:
```gradle
classpath 'com.google.gms:google-services:4.4.2'
```
