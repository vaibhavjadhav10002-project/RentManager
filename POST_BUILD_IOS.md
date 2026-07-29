# iOS — post-`cap add ios` Info.plist edits

`npx cap add ios` generates `ios/App/App/Info.plist` from Capacitor's
template (macOS + Xcode required — this can't be run in a sandboxed
Linux environment). Apply these once it exists.

## 1. Permission usage strings (required — App Store rejects builds without these if the API is ever called)
Add inside the root `<dict>`:

```xml
<key>NSCameraUsageDescription</key>
<string>Used to take photos for tenant ID verification and document uploads.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Used to attach photos for tenant ID verification and document uploads.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Used to save generated receipts, agreements, and tenant ID cards.</string>
```

## 2. Universal links (associated domains)
In Xcode: target → Signing & Capabilities → + Capability → "Associated Domains" → add:
```
applinks:your-app.vercel.app
```
Replace with your real production domain. This also requires hosting `https://your-app.vercel.app/.well-known/apple-app-site-association` (no file extension, served as `application/json`) — see https://developer.apple.com/documentation/xcode/supporting-associated-domains.

## 3. Dark Mode / Dynamic Island
No manual Info.plist edit needed — `contentInset: 'automatic'` in `capacitor.config.ts` plus the runtime status-bar sync in `src/lib/native/bootstrap.ts` already handle this.

## 4. Push capability
In Xcode: target → Signing & Capabilities → + Capability → "Push Notifications", and separately "Background Modes" → check "Remote notifications". Required even before you implement the APNs relay server-side (MOBILE_BUILD_REPORT.md §7) — without this capability enabled, `PushNotifications.register()` fails at the OS level.

## 5. Orientation
Confirm only Portrait is checked under target → General → Deployment Info (matches `manifest.json`'s `"orientation": "portrait-primary"`).
