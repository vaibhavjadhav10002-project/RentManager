# Release Automation

**Release Automation only — no application business logic/UI/financial logic changed.**

This document describes `.github/workflows/release.yml` and everything it touches.

## What triggers it

- `git push` to `main` → full pipeline (validate → deploy → Android build →
  release → publish version metadata).
- Pull requests into `main` → **validation only** (lint + build). Nothing
  deploys, nothing gets signed, no release is created.
- Manual: **GitHub → Actions → Release Automation → Run workflow** (uses
  `workflow_dispatch`), runs the exact same pipeline as a push to `main`.

## Pipeline

```
push to main
   │
   ▼
validate            npm ci → lint → build → compute version (versionCode,
                     versionName, tag, apk filename, predicted download URL)
   │
   ▼
deploy               vercel pull/build/deploy --prod (real Vercel env vars,
                     app itself only — app-version.json untouched here)
   │
   ▼
android-build        npx cap sync android → gradlew assembleRelease
                     (signed, using GitHub Secrets) → verify signature →
                     upload APK as a workflow artifact
   │
   ▼
release              GitHub Release created at the pre-computed tag,
                     signed APK attached, notes auto-generated from commits
   │
   ▼
publish-version-metadata   regenerate public/app-version.json with the now-
                     confirmed release info → second Vercel prod deploy so
                     the live "Update Now" flow points at a real asset
```

Each job only starts if the one before it succeeded (`needs:`). If lint,
build, the Vercel deploy, the Gradle build, or the signature check fails,
**everything downstream is skipped** — no tag, no release, no APK asset,
and the live `app-version.json` is never touched. Full logs and (for the
Android job) the built APK are preserved as workflow artifacts for 90 days
even on failure, for debugging.

## Versioning — single source of truth

- **`android/version.properties`** (`versionBase=1.0`) is the only file you
  ever edit by hand, and only when you want to signal a deliberate
  minor/major bump (`1.0` → `1.1` or `2.0`).
- **versionCode** = the GitHub Actions run number. Always increasing,
  never touched by hand, satisfies Android's "every release must have a
  higher versionCode" requirement forever.
- **versionName** = `{versionBase}.{run_number}`, e.g. `1.0.42`. This gives
  you the `v1.0.1`, `v1.0.2`, `v1.0.3`... sequence you asked for — starting
  from whatever the run number happens to be the first time this runs, not
  literally from 1, since nothing destructive was done to force that.
- Your existing `public/app-version.json` / `AppUpdateChecker` system is
  **kept as the only in-app update mechanism** — nothing new was invented.
  The workflow only ever *writes* to it (via `scripts/ci/update-app-version.mjs`),
  and only overwrites `latestVersion`, `versionCode`, `releaseDate`,
  `apkDownloadUrl`, and `apkSizeMB`. It deliberately never touches
  `forceUpdate`, `minimumSupportedVersion`, or `minimumSupportedVersionCode`
  — those stay manual, deliberate decisions you make by hand in that file.

## Signing

No keystore exists in the repo, and none was generated or faked. Signing is
wired end-to-end in `android/app/build.gradle` via a `signingConfigs.release`
block that only activates when `ANDROID_KEYSTORE_PATH` /
`ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`
are present as environment variables. Locally (Android Studio, `./gradlew
assembleDebug`, etc.) those aren't set, so the file behaves **exactly as it
did before** — this change is invisible to your local workflow.

In CI, the `android-build` job:
1. Explicitly checks all four signing secrets (+ `CAPACITOR_SERVER_URL`)
   are present and **fails immediately with a clear error** if any are
   missing — it does not fall back to building an unsigned APK for a real
   release.
2. Decodes `ANDROID_KEYSTORE_BASE64` to a temp file that only exists for
   the duration of that one job, then deletes it in an `if: always()`
   cleanup step.
3. After building, runs `apksigner verify` on the output and fails the job
   if the APK isn't actually properly signed — belt-and-suspenders on top
   of (1).

## Files changed

| File | Change |
|---|---|
| `.github/workflows/release.yml` | **New.** The entire pipeline described above. |
| `android/app/build.gradle` | versionCode/versionName now read from Gradle project properties (fallback to original hardcoded `1`/`"1.0"`); added a conditional `signingConfigs.release` that only activates when signing env vars are present. No other line changed. |
| `android/version.properties` | **New.** Single source of truth for the human-controlled `MAJOR.MINOR` base version. |
| `scripts/ci/update-app-version.mjs` | **New.** CI-only Node script that regenerates `public/app-version.json`, preserving every field `src/lib/update/types.ts` requires. |
| `.gitignore` | Added patterns for keystores, keystore properties files, base64-encoded keystore dumps, and CI-generated APK/AAB output dirs. |
| `RELEASE_AUTOMATION.md` | **New.** This file. |

Nothing in `src/`, `supabase/`, `capacitor.config.ts`, `vercel.json`, or any
UI/business/financial code was touched.

## What has been verified (in this sandboxed environment)

- **Locally verified:** `.github/workflows/release.yml` parses as valid
  YAML with the expected job graph (`validate` → `deploy` → `android-build`
  → `release` → `publish-version-metadata`); `android/app/build.gradle` has
  balanced braces and unchanged `applicationId`/`namespace`
  (`com.rentivo.app`, matching `capacitor.config.ts`'s `appId`) and
  unchanged `minSdkVersion`/`compileSdk`/`targetSdk`; `scripts/ci/update-app-version.mjs`
  runs successfully end-to-end against a copy of your real
  `public/app-version.json` and produces output that satisfies every check
  in `validateAppVersionConfig()` (all required fields present, correct
  types, `apkDownloadUrl` a real absolute URL).
- **Statically verified (read-through, not executed):** the Gradle
  `signingConfigs`/`buildTypes` conditional logic, the version-computation
  bash step, the predicted GitHub Release asset URL format
  (`https://github.com/{repo}/releases/download/{tag}/{filename}`, which is
  GitHub's documented, deterministic format — this is what lets
  `app-version.json` be pre-computed correctly).
- **Requires GitHub to verify:** the actual `npm run build`/`lint` run
  inside the Actions runner, the real Vercel CLI deploy, `npx cap sync
  android` + `./gradlew assembleRelease` on a real Android SDK/JDK
  toolchain, `apksigner verify` against a real signed APK, and the GitHub
  Release/asset-upload step. None of these can run in this sandbox (no
  network, no Android SDK) — nothing here is claimed to have actually
  executed successfully end-to-end until you run it on GitHub.

## Required GitHub Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Used by | Purpose |
|---|---|---|
| `VERCEL_TOKEN` | `deploy`, `publish-version-metadata` | Vercel Account Settings → Tokens |
| `VERCEL_ORG_ID` | same | From `.vercel/project.json` after `vercel link` locally, or Vercel project settings |
| `VERCEL_PROJECT_ID` | same | Same as above |
| `ANDROID_KEYSTORE_BASE64` | `android-build` | `base64 -i your.keystore \| tr -d '\n'` |
| `ANDROID_KEYSTORE_PASSWORD` | `android-build` | Set when you generate the keystore |
| `ANDROID_KEY_ALIAS` | `android-build` | Set when you generate the keystore |
| `ANDROID_KEY_PASSWORD` | `android-build` | Set when you generate the keystore |
| `CAPACITOR_SERVER_URL` | `android-build` | Your real production domain, e.g. `https://rentivo.vercel.app` — the same value `capacitor.config.ts` already expects |

None of these exist yet in code, in this ZIP, or anywhere committed. Until
they're added, `deploy`/`android-build`/`publish-version-metadata` will
fail fast with a clear `::error::` message naming exactly which secret is
missing — by design, not a bug.

## Laptop Required Later

Only these three things genuinely need your machine / manual setup — everything
else in this document is already done in code:

1. **Generate the release keystore** (see the earlier walkthrough — `keytool
   -genkeypair ...`). Back it up somewhere outside git; losing it means you
   can never publish an update to `com.rentivo.app` signed with the same
   key again.
2. **Add all 8 secrets above** to GitHub (Settings → Secrets and variables
   → Actions).
3. **Get your Vercel `ORG_ID`/`PROJECT_ID`**: run `npx vercel link` once
   locally in the project root (requires being logged into the correct
   Vercel account), then read them out of the generated `.vercel/project.json`.

## First-run procedure (once secrets are added)

```bash
git add .
git commit -m "Add release automation"
git push origin main
```

That's it — the full pipeline runs automatically. Watch it under the repo's
**Actions** tab. First run will produce `v{versionBase}.{run_number}` — e.g.
if this is Actions run #7, you'll get `v1.0.7` as your first tag/release
(not `v1.0.1` — see the versioning section above for why, and edit
`android/version.properties` any time you want to reset the "MAJOR.MINOR"
part for a deliberate bump).

## Manual fallback

If you ever need to trigger a release without pushing a new commit:
**GitHub → Actions → Release Automation → Run workflow → Run workflow**
(this is the `workflow_dispatch` trigger already in the file). Runs the
identical pipeline against the current `main`.

You can still do everything manually the old way at any time — this
automation doesn't remove or lock out `npx cap open android` / Android
Studio; it's purely additive.

## Rollback

Disabling this automation never touches the app itself — it's entirely
contained to `.github/workflows/`, `android/version.properties`,
`scripts/ci/`, and the two small `build.gradle`/`.gitignore` edits above.

- **Disable without deleting:** GitHub → Actions → Release Automation →
  "..." menu → **Disable workflow**. Nothing else changes; go back to your
  manual process any time.
- **Fully revert:** `git revert` the commit that introduced these files, or
  delete `.github/workflows/release.yml` and `android/version.properties`
  and `scripts/ci/update-app-version.mjs`, and revert the two edits in
  `android/app/build.gradle` / `.gitignore`. `android/app/build.gradle`
  falls back to hardcoded `versionCode 1` / `versionName "1.0"` behavior
  automatically the moment the CI-only Gradle properties aren't being
  passed in — so even a partial rollback (just deleting the workflow file)
  leaves local builds completely unaffected.
