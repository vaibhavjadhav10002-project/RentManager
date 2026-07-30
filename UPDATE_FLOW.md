# UPDATE_FLOW.md

## Every launch (native only)
```
App launches
  → isNative()? ── no ──→ nothing happens (web/PWA always current)
      │ yes
      ▼
  fetch /app-version.json (6s timeout, no-store cache)
      │
      ├─ fails / times out / bad JSON / fails validation ──→ nothing happens, app continues normally
      │
      ▼ succeeds + valid
  compare installed versionCode vs config
      │
      ├─ up to date ──→ nothing happens
      │
      ├─ installed < minimumSupportedVersionCode ──→ FORCE dialog
      ├─ forceUpdate: true AND installed < versionCode ──→ FORCE dialog
      └─ installed < versionCode (otherwise) ──→ OPTIONAL dialog
                                                     │
                                                     ├─ recently dismissed this exact versionCode (< 3 days) ──→ nothing happens
                                                     └─ otherwise ──→ shows
```

## Optional update dialog
- **Update Now** → opens `apkDownloadUrl` in the system browser
- **Later** → records the dismissal (this `versionCode` + timestamp),
  dialog closes, app continues fully normally
- Tapping the backdrop behaves the same as **Later**
- Won't reappear this session, and won't reappear for up to 3 days
  unless a *newer* `versionCode` is published in the meantime — a new
  release always shows immediately regardless of how recently the
  previous one was dismissed

## Force update dialog
- **Update Now** is the only button — no "Later," no backdrop-dismiss
- Shows the "This update is required to continue using Rentivo."
  message
- Reappears on every launch (and would reappear immediately if somehow
  dismissed, since there's no dismiss path at all) until the installed
  `versionCode` meets the requirement

## Explore Mode & authentication
This flow has no branch for login state — it runs identically whether
the person is exploring, logged in as an owner, or (in principle) on
the pre-auth screens. See `APP_UPDATE_SYSTEM.md`'s "Explore Mode &
login-state independence" for why that's true by construction rather
than by special-casing.

## Failure modes — all fail silent, none block startup
| Situation | Result |
|---|---|
| No network / airplane mode | Fetch rejects → caught → no dialog |
| Request takes > 6s | AbortController fires → caught → no dialog |
| Server returns non-2xx | `res.ok` false → no dialog |
| Response body isn't valid JSON | `res.json()` throws → caught → no dialog |
| JSON is valid but missing/wrong-typed fields | `validateAppVersionConfig` returns `null` → no dialog |
| `App.getInfo()` fails (shouldn't happen, but defensively handled) | Caught → no dialog |

In every case above, the app's normal startup and every existing route
is completely unaffected — this feature can only ever add a dialog on
top of a normally-functioning app, never prevent one from loading.
