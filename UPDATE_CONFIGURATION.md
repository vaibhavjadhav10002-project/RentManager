# UPDATE_CONFIGURATION.md

## Where it lives
`public/app-version.json`, served at `https://<your-production-domain>/app-version.json`
— the exact same origin the Capacitor Android/iOS shell already loads
(see `capacitor.config.ts`), so no CORS configuration is needed.

## Publishing a new version — no app rebuild required
1. Edit `public/app-version.json` in the repo (fields below).
2. Deploy the web app as normal (Vercel, or whatever host serves this
   project).
3. Every installed APK now sees the new config on its next launch — no
   Play Store, no new APK build, no user action needed to *see* the
   prompt (only to act on it).

## Fields

| Field | Type | Meaning |
|---|---|---|
| `latestVersion` | string | Human-readable version shown in the dialog (e.g. `"1.2.0"`) |
| `versionCode` | integer | The real comparison value — must match the `versionCode` you build into the Android APK (`android/app/build.gradle`) |
| `minimumSupportedVersion` | string | Human-readable floor version, shown nowhere but kept for your own reference/ops |
| `minimumSupportedVersionCode` | integer | Below this, the app **always** force-updates regardless of `forceUpdate` — use this to hard-cut off very old builds (e.g. ones with a security issue) |
| `forceUpdate` | boolean | `true` forces the current `latestVersion` even if the installed build is above `minimumSupportedVersionCode` |
| `releaseDate` | string | Shown in the dialog as-is (e.g. `"2026-07-29"`) |
| `apkDownloadUrl` | absolute URL | Where "Update Now" sends the user — validated as a real absolute URL before use |
| `apkSizeMB` | number (optional) | Shown in the dialog if present; omit to hide that field |
| `releaseNotes` | string[] | Bulleted "What's New" list in the dialog |

## Validation
Every field is checked by `src/lib/update/types.ts`'s
`validateAppVersionConfig()` before anything else touches it — a typo,
missing field, or wrong type simply results in the update check quietly
doing nothing (see `APP_UPDATE_SYSTEM.md`'s failure-mode list), never a
crash. There is no schema enforcement at the file level (it's a plain
JSON file, not a database row with constraints) — validate your edits
against the table above before deploying, since nothing else will stop
a malformed file from shipping other than this runtime check silently
ignoring it.

## Choosing `forceUpdate` vs raising `minimumSupportedVersionCode`
- Use `forceUpdate: true` for "everyone should be on the newest build
  soon" (a good feature, a UX fix) — still framed as urgent but not a
  hard cutoff of old versions.
- Raise `minimumSupportedVersionCode` for "this old build must stop
  working" (a breaking API change, a security fix) — this is the harder
  guarantee and the one worth using sparingly and deliberately.
