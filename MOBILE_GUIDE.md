# MOBILE_GUIDE.md

Short version for anyone who needs the mobile picture without the full
build runbook. For actual build/submission steps, see
`MOBILE_BUILD_REPORT.md`, `POST_BUILD_ANDROID.md`, `POST_BUILD_IOS.md`.
For the audit history of the mobile work itself, see
`RC_AUDIT_REPORT.md` and the "Mobile App" / "Release Candidate Audit"
entries in `CHANGELOG.md`.

## The one thing to understand
The Android/iOS app is **not** a separate build of this codebase — it's
a Capacitor native shell that loads the live deployed web app inside a
WebView, with native capabilities (camera, share, push, back button,
deep links) bridged in on top. One deploy (Vercel) serves web, PWA, and
both native apps simultaneously. See `capacitor.config.ts`'s top comment
and `MOBILE_BUILD_REPORT.md` §1 for the full reasoning.

**Practical implication:** there is no separate "mobile deploy" step —
deploying the web app to Vercel updates every platform (web, PWA,
Android, iOS) the next time each is opened. You never rebuild the
native app just to ship a UI/logic change; only rebuild the native
app when a native capability, icon, permission, or the Capacitor config
itself changes.

## Where the native-specific code lives
`src/lib/native/` — platform detection, native bootstrap (status bar,
splash, back button, deep links), file save/share, camera, clipboard,
push registration. Everything there degrades to a no-op or a web
fallback when not running inside the native shell, so this code is safe
to import from anywhere without breaking the website.

## Native push notifications — current status
Client-side registration is implemented; the server-side delivery relay
(Firebase Admin SDK for Android, APNs HTTP/2 for iOS) is a clearly
marked, not-yet-implemented stub in `src/app/api/push/send/route.ts`,
pending your own Firebase project / APNs key. Web Push (browser/PWA) is
unaffected and keeps working exactly as before. See
`MOBILE_BUILD_REPORT.md` §7 for the exact setup steps.

## Testing checklist before every native release
- Back button navigates correctly and exits only when there's nowhere left to go
- A deep link / notification tap opens the correct in-app screen
- PDF receipt/agreement download opens the native share sheet, not a broken/silent no-op
- Status bar color matches light/dark theme
- Safe areas are respected on a notched/Dynamic-Island device
- Offline fallback page appears if network drops mid-session (test explicitly on iOS — see `RC_AUDIT_REPORT.md` §4 for why this one needs a dedicated device check)
