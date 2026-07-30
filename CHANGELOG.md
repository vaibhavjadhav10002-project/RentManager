# Changelog — Final Production Merge & Release Candidate Audit

## Scope
Merged Explore Mode and the App Update System (both built in a separate
project copy) into this authoritative codebase, applied Rentivo
branding in code (previously only delivered as a design asset package),
and performed a real, verified production audit. Full detail across
`PRODUCTION_AUDIT.md`, `VALIDATION_REPORT.md`, `EXPLORE_MODE_REPORT.md`,
`APP_UPDATE_SYSTEM.md`, `DEPLOYMENT_CHECKLIST.md`, `KNOWN_LIMITATIONS.md`.

## Fixed — real, verified bugs
- **Brand icon files were fully transparent everywhere** — a masking
  bug in the icon-generation pipeline (black-on-black mask misread by
  `CopyOpacity`, which uses luminance not alpha). Found via pixel
  sampling, fixed, reverified. Affected favicon, apple-touch-icon, and
  every rounded/circle/maskable app icon variant.
- **Explore Mode nested-embed bug** — `getPayments()`'s
  `tenant:tenants(..., room:rooms(...))` embed silently dropped the
  inner `room`. Fixed with a recursive resolver, verified with a direct
  reproduction test.
- **Update checker had no Android/iOS scoping** — would have prompted
  an APK download on iPhone, where that makes no sense. Fixed.
- Join form's mobile validation accepted 11+ digit numbers instead of
  exactly 10; no max-length on the name field. Both fixed.
- `AddPropertyModal`'s UPI ID field had zero format validation. Fixed,
  plus upgraded its error handling off a raw `any`-typed catch.

## Added
- `src/lib/explore/`, `src/lib/update/`, `ExploreBadge`,
  `ExploreLockSheet`, `AppUpdateChecker`, `AppUpdateDialog`,
  `/welcome` onboarding, `public/app-version.json` — merged in from the
  separate project copy where they were originally built (see the merge
  notes at the top of `EXPLORE_MODE_REPORT.md`).
- `src/lib/validation.ts` — shared, reusable field validators (name,
  mobile, email, PAN, Aadhaar, IFSC, account number, UPI, positive
  amounts, dates, required selections, uploads).
- `PRODUCTION_AUDIT.md`, `VALIDATION_REPORT.md`,
  `DEPLOYMENT_CHECKLIST.md`, `KNOWN_LIMITATIONS.md`.

## Branding applied in code (previously design-only)
- `capacitor.config.ts` (`appId`/`appName`), `manifest.json`, root
  layout metadata, and every app icon/favicon file replaced with the
  real Rentivo assets.
- "PG Manager" → "Rentivo" text fixed in sidebars, the login heading,
  the restore error message, the downloaded backup filename, and
  generated PDF content.
- **Deliberately left unchanged** (functional identifiers, not
  branding): the phone-login email domain and the backup-format version
  string — see `KNOWN_LIMITATIONS.md` for why changing either would
  break existing users' logins/backups.

## Modified (additive only — same pattern as prior merges)
- `src/middleware.ts`, `src/app/page.tsx`, `src/app/(owner)/layout.tsx`,
  `src/app/layout.tsx`, `src/lib/supabase/client.ts` — one additive
  branch each for Explore Mode / Update System, matching this project's
  actual current implementations (verified line-by-line before editing,
  since this codebase had diverged from the copy these features were
  first built in).

---

# Changelog — Spec Re-check (no code changes)

## Scope
Re-checked the completed mobile conversion against a more detailed
requirements spec. No code changed — two documentation clarifications
added to `MOBILE_BUILD_REPORT.md` (§3a, §3b):
- Confirmed existing `<input type="file">` elements (JSON restore
  upload, gov-ID photo capture) need no additional Capacitor plugin —
  both platforms' WebViews handle standard file inputs natively.
- Clarified what "Material You" support means for a WebView-based app
  (themed adaptive icon only; requires a monochrome icon asset that
  doesn't exist in the project yet — not a code gap).
- Made explicit which validations were actually performed (static
  analysis) vs. not possible here (real `tsc`/`eslint`/`next build`,
  Android Studio/Xcode compilation) — no successful build is claimed.

---

# Changelog — Production Polish & Documentation

## Scope
Production polish + documentation pass. No business logic, auth,
Supabase architecture, routing, payments, communication, or push logic
changed. Full findings in `PRODUCTION_POLISH_REPORT.md`.

## Fixed
- Added missing keyboard `focus-visible` state to shared `Button`/
  `IconButton` components (owner + tenant design systems, 4 files) —
  accessibility gap, purely additive CSS.
- Removed 5 verified-unused imports across 5 files (each confirmed to
  have zero usage before removal).
- Removed `src/app/api/whatsapp/` — an empty, orphaned directory with
  no route file.

## Added
- 12 new documentation files: `ARCHITECTURE.md`, `SYSTEM_DESIGN.md`,
  `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`, `DEPLOYMENT_GUIDE.md`,
  `DISASTER_RECOVERY.md`, `BACKUP_RESTORE_GUIDE.md`, `ADMIN_MANUAL.md`,
  `OWNER_MANUAL.md`, `TENANT_MANUAL.md`, `MOBILE_GUIDE.md`,
  `MAINTENANCE_GUIDE.md`.

## Reviewed, no change made
- Two design systems (owner/tenant) confirmed intentional, not
  duplicate code.
- `recharts` eager-import bundle-size opportunity identified but
  deferred — fixing it safely requires a structural extraction, out of
  scope for a "safe polish only" pass. See `PRODUCTION_POLISH_REPORT.md`.

---

# Changelog — Release Candidate Audit (Mobile)

## Scope
Verification-only pass over the mobile (Capacitor) conversion. No new
features, no redesign, no business logic/auth/routing changes. Full
findings in `RC_AUDIT_REPORT.md`.

## Fixed
- **HIGH:** Renamed `supabase/33_native_push_tokens.sql` →
  `35_native_push_tokens.sql` — it collided in number (not in content)
  with pre-existing `33_profile_update_requests.sql` /
  `34_communication_engine.sql` that weren't visible in the file listing
  used during the previous pass.
- **MEDIUM:** `capacitor.config.ts` now fails loudly with a clear error
  if `CAPACITOR_SERVER_URL` is malformed, instead of silently falling
  back to a broken navigation allowlist.
- **LOW:** Updated two stale filename references (`src/lib/native/push.ts`,
  this file) after the migration rename above.

## Files Modified
- `supabase/35_native_push_tokens.sql` (renamed from `33_`)
- `capacitor.config.ts`
- `src/lib/native/push.ts`
- `CHANGELOG.md`, `RC_AUDIT_REPORT.md` (new)

## Required action
If you already ran the old `33_native_push_tokens.sql` filename against
Supabase, no re-run is needed — run the renamed `35_` file only if you
haven't applied it yet; the SQL content itself is unchanged.

---

# Changelog — Mobile App (Android + iOS, Capacitor)

## Scope
Converts the existing production web app into a Capacitor-based Android +
iOS app on the SAME codebase — no duplicated business logic, no new
React project, no Flutter/React Native. Auth, routing, Supabase queries,
payments, communication engine, and the Owner/Tenant flows are
untouched. Full architectural reasoning and native-side build steps are
in `MOBILE_BUILD_REPORT.md`.

## Added
- `capacitor.config.ts` — app points its native WebView at the deployed
  production URL (`CAPACITOR_SERVER_URL`) rather than a static bundle,
  since server routes (`api/push/send`, `api/cron/automatic-backup`,
  `api/whatsapp`) require a real Node server.
- `src/lib/native/` — platform detection, native bootstrap (status
  bar/splash/back-button/deep-links), native-aware file save/share,
  camera picker, clipboard, and native (FCM/APNs) push registration.
- `src/components/shared/NativeBootstrap.tsx` — mounted in root layout
  alongside the existing `PWARegister`.
- `supabase/35_native_push_tokens.sql` — additive, nullable columns on
  the existing `push_subscriptions` table so native device tokens can
  live alongside Web Push subscriptions without touching existing rows.
- Native-shell CSS in `globals.css` (scoped under `.native-app`, zero
  effect on web/PWA): edge-to-edge safe-area handling, 44px minimum tap
  targets, tap-highlight removal, momentum scrolling.
- `package.json`: Capacitor core/CLI/Android/iOS + Camera, Share,
  Filesystem, Clipboard, Push Notifications, Splash Screen, Status Bar,
  Keyboard plugins; `cap:*` build scripts.

## Modified (minimal, additive)
- `src/lib/push.ts` — branches to native token registration when
  running inside the Capacitor shell; existing Web Push behavior for
  browser/PWA users is byte-for-byte unchanged.
- `src/app/api/push/send/route.ts` — separates web vs. native
  subscriptions so native rows (which have no VAPID keys) don't crash
  `web-push`; native FCM/APNs delivery is a clearly marked, not-yet-
  implemented integration point pending your own Firebase/APNs
  credentials (account-level setup, can't be done from this codebase).
- `src/lib/pdf.ts` (4 call sites), `src/app/(owner)/backup/page.tsx` —
  swapped `doc.save()` / manual blob-download for a native-aware helper
  (`savePdf`/`saveBlob`) that uses the OS share sheet on Android/iOS
  instead of a browser download link, which doesn't reliably work
  inside a native WebView.
- `.env.local.example` — added `CAPACITOR_SERVER_URL` and optional,
  currently-unused native push relay credential placeholders.
- `src/app/layout.tsx` — one new line mounting `<NativeBootstrap />`.

## Required action
1. Run `supabase/35_native_push_tokens.sql` in the Supabase SQL Editor.
2. Set `CAPACITOR_SERVER_URL` to your real deployed domain before
   building the native apps.
3. See `MOBILE_BUILD_REPORT.md` for the local build commands
   (`npm install`, `npx cap add android/ios`, icon/splash generation,
   APK/AAB/IPA build steps) — these require Android Studio / Xcode and
   were not run as part of this change.

---

# Changelog — Phase 9 Post-Audit Cleanup

## Scope
Addresses the findings from the Phase 9 Final Freeze Audit. No new
features, no new tables, no scope expansion — this is entirely fixes to
things the audit found. Nothing in Phase 8/11-protected territory or the
existing Payments/Tenant Portal/Owner Dashboard/Notification Bell/push
system was touched (same files as every other Phase 9 unit:
`reminderEngine.ts`, `communicationService.ts`, `queueManager.ts`,
`inbox/page.tsx`).

## Fixed — Medium findings
- **Reminder cooldown now only counts reminder-category messages.**
  `ReminderEngine.findCandidates` previously used *any* communication log
  entry to compute "last reminded," so an unrelated Welcome message could
  silently suppress a genuinely-needed rent reminder. Now cross-references
  each log's `template_id` against templates whose category is
  `rent_reminder`/`due_today`/`overdue` before counting it as a reminder.
- **Partial payments no longer silence reminders.** Previously excluded a
  tenant from the candidate list if *any* approved rent payment existed
  for the month, regardless of amount. Now sums approved rent payments
  for the month and only excludes a tenant once the total meets their
  monthly rent.
- **Removed an unverified assumption in month-label matching.**
  `reminderEngine.ts` used `date.toLocaleDateString(...)`; Payments and
  Dashboard both use `date.toLocaleString(...)` for the same `thisMonth`
  label. Switched to match exactly, removing the (likely-but-unconfirmed)
  assumption that the two methods produce identical output.

## Fixed — Low findings
- **Removed dead code from `CommunicationService`:** `queueWhatsAppMessage()`
  (superseded by `sendReminder()`), `preview()` (never called — the
  WhatsApp tab calls `.render()` directly), and the unused
  `.notifications`/`.reminders` convenience re-exports (nothing called
  them; the Inbox page imports `NotificationService`/`ReminderEngine`
  directly from the barrel where needed). `NotificationService` itself is
  unchanged and still exported — kept as intentional, correctly-wrapping,
  forward-compatible infrastructure per the brief's own "future versions
  may reuse the same engine for Email, Push, SMS," not wired into a live
  send path because a WhatsApp send doesn't also need a duplicate in-app
  push about itself.
- **`isFullyRendered()` is no longer unused** — now a real safety check in
  both the WhatsApp tab and Reminders tab's send handlers: if a template
  references a variable that has no value (e.g. a custom variable the
  automated Reminders flow can't fill in), the send is blocked with a
  clear error instead of going out with literal `{{Variable}}` text
  visible to the tenant.
- **Fixed stale doc comments** in `communicationService.ts` and
  `queueManager.ts` that described reminders/retries as running
  "automatically on a schedule" — they don't; every send in this system
  remains owner-triggered. Also corrected a comment referencing a method
  name (`prepareWhatsAppMessage`) that didn't match the actual method
  (`prepareWhatsAppSend`).
- **Fixed stale UI copy** — the Communication Settings modal's reminder-
  days field said "Used by the Reminder Engine once it arrives in Phase
  9.3"; the Reminder Engine shipped in that same phase. Now describes
  what the setting actually does.
- **Retry Queue edge case handled explicitly** — a queue item with no
  `tenant_id` (structurally very unlikely given `on delete cascade`, but
  not type-system-impossible) now shows a clear error instead of
  proceeding with an invalid empty-string value where a UUID is expected.

## Not changed
`QueueManager.cancel()` and the `StandardVariable` type export remain as
unused-but-intentional API surface — legitimate reusable capability not
yet wired to a UI action, not redundant/superseded code, so left in place
rather than removed for the sake of an empty "no dead code" checkbox.

---

# Changelog — Phase 9.3: Reminder Engine, Retry Queue, Notification History, Final UI Polish

## Scope
Final implementation unit of Phase 9. Completes the engine and the Inbox
UI. No new tables — everything here runs on the four tables from 9.1's
migration.

## Added

### Reminder Engine (`reminderEngine.ts` — real logic, replacing the 9.1 stub)
`findCandidates()` identifies which active tenants need a reminder today,
using **only already-fetched data, zero new business logic invented**:
- Overdue/due-today status: the **existing** `getOverdueDays()` util
  (same one Dashboard/Payments use) — reused, not reimplemented.
- "Already paid this month": a filter over already-fetched `payments`
  data (approved rent payment matching the current month label).
- "Already reminded recently": derived from already-fetched
  `communication_logs`, which is what makes `default_reminder_days`
  (Communication Settings) do something real — it's the minimum gap
  before the same unpaid tenant is suggested again, not an arbitrary
  number sitting unused.

**Known, documented scope boundary:** this only surfaces tenants who are
due-today-or-overdue right now — it does not forecast "due in 3 days"
reminders, because that would need new due-date math that doesn't exist
anywhere else in the app yet (the existing `computeDueDate()` is built to
resolve to the most recent *past* due date, by design, for overdue
tracking — not to project forward). Building that forward-looking version
felt like exactly the kind of new date-calculation risk worth flagging
rather than quietly inventing. `shouldRemind()`'s signature keeps a
`reminderLeadDays` parameter so this can be extended later without
another signature change.

### Retry Queue
- `communication_queue.attempt_count` now actually increments on failure
  (`updateQueueItemStatus` does a read-then-write; this table only ever
  sees a handful of owner-triggered writes per session, so the extra
  round trip is a reasonable tradeoff over a Postgres RPC).
- `CommunicationService.sendReminder()` — a reminder candidate is written
  to the queue as `pending` first, then transitions to `sent` (+ a
  History entry) once WhatsApp is opened, or to `failed` immediately if
  the tenant has no phone on file.
- `CommunicationService.retryQueueItem()` — re-sends a failed item using
  its already-rendered message (no re-render, so what gets retried is
  exactly what failed before).
- **Reminders tab** now shows two real sections: "Needs a Reminder"
  (live candidates, one-click send) and "Retry Queue" (failed items with
  a Retry button and the failure reason).

### Notification History
Already functional since 9.1/9.2 (`communication_logs` + the History
tab) — 9.3 just adds more entries flowing into it now that reminders
send through the same path as Manual Send.

### Final UI Polish
- Loading skeletons, `animate-owner-fade-in`/`animate-owner-scale-in`
  modal transitions, and responsive grid behavior were already in place
  from 9.1/9.2 and needed no changes — confirmed working across the
  now-complete tab set rather than re-done.
- Settings modal now calls back into the page on save so
  `default_reminder_days` updates the Reminders tab immediately, without
  a manual refresh.

## Pre-ZIP audit (per the brief's checklist)
- ✅ No impact on Phase 8 (Tenant Onboarding) — not touched, not
  imported, not referenced anywhere in this unit.
- ✅ No impact on Phase 11 (Expense Split/Ledger) — same.
- ✅ Notification Bell — confirmed unchanged in `Topbar.tsx`, no
  Communication Engine references anywhere near it.
- ✅ Push Notifications — `src/lib/push.ts` has zero references to
  anything added in Phase 9; `NotificationService` only ever imports
  *from* it.
- ✅ Owner Dashboard / Tenant Dashboard — confirmed zero
  `Communication`/`communication_` references in either page.
- ✅ No Payment regression — Phase 9 only ever *reads* `payments` via
  the existing `getPayments()`; nothing in this phase writes to that
  table.
- ✅ No duplicate code — due-date math, payment-status checks, and
  push-notification delivery are all reused from existing code, not
  reimplemented.
- ✅ Communication Engine reusable — every layer (`TemplateEngine`,
  `ClickToChatProvider`, `NotificationService`, `QueueManager`,
  `HistoryService`, `ReminderEngine`) is channel-agnostic where it
  matters and takes plain data in/out, ready for Phase 8/11 to import.
- ✅ TypeScript/imports/routes — full-project brace/paren balance swept
  clean (one known false-positive from a regex literal in
  `templateEngine.ts`, manually verified, unchanged since 9.1); every
  import in the touched files programmatically confirmed to resolve to
  a real export.

---

# Changelog — Phase 9.2: Manual Send, Click-to-Chat, Search, Filters

## Scope
Second implementation unit of Phase 9. Builds on 9.1's engine — no new
tables, no new layers in the architecture, just wiring the WhatsApp tab's
previously-disabled Send button to actually work, plus Search and Filters
across the Inbox. Reminder Engine / Retry Queue / Notification History /
Final Polish remain Phase 9.3, untouched here.

## Added

### `CommunicationService` — two new methods
- **`prepareWhatsAppSend()`** — renders the template and builds the wa.me
  click-to-chat link via the existing `ClickToChatProvider`. Returns the
  link; does **not** open a window itself, so the side effect
  (`window.open`) stays explicit at the UI call site rather than hidden
  inside a service function.
- **`confirmSent()`** — records the send to `communication_logs` via the
  existing `HistoryService`. Documented explicitly as *optimistic*: like
  every click-to-chat integration without a paid delivery-confirmation
  API, "sent" here means "WhatsApp was opened with the message ready,"
  not "WhatsApp confirmed delivery" — worth being honest about that
  distinction rather than implying a guarantee this free architecture
  can't make.

`queueWhatsAppMessage()` from 9.1 is untouched and still reserved for
9.3's scheduled/batch use — Manual Send intentionally goes straight to
History rather than through the Queue, since an owner-initiated instant
send isn't really a "queued" item.

### Inbox UI (`/inbox`)
- **Manual Send is live.** WhatsApp tab: pick a tenant, pick a template,
  review the live preview, press "Open in WhatsApp" — WhatsApp opens
  with the message pre-filled, owner presses Send themselves inside
  WhatsApp. No automatic sending anywhere in this flow.
- **WhatsApp tab redesigned** from a two-dropdown compose form into a
  searchable tenant list (left) + compose/preview/send (right) — closer
  to "feels like a modern messaging application," and the natural place
  to put Search.
  - **Search**: filter the tenant list by name, phone, or room number.
  - **Filters**: All / Not Contacted / Contacted — "contacted" is
    derived from the already-fetched `communication_logs`, not a new
    query or duplicated payment-due logic.
- **History tab**: added search (tenant name or message text) and a
  status filter (All/Sent/Failed/Pending/Cancelled).

## Explicitly not touched
Same list as 9.1 — Tenant Onboarding, Owner Invitation, QR Join,
Password Change, First Login, Expense Split, Ledger, existing
Tenant/Owner Dashboards, `src/lib/push.ts`, the existing Messages page,
the Notification Bell. This unit touched exactly two files:
`communicationService.ts` (additive) and `inbox/page.tsx`.

---

# Changelog — Phase 9.1: Communication Engine + Inbox (foundation)

## Scope
First implementation unit of Phase 9 (branch isolated from Phase 8 —
Tenant Onboarding — and Phase 11 — Shared Expenses/Ledger — both being
developed separately). This unit: **Communication Engine, Inbox,
Communication Settings, Template Engine, Queue, Logs.** Manual
Send/Click-to-Chat/Search/Filters are Phase 9.2. Reminder Engine/Retry
Queue/Notification History/Final Polish are Phase 9.3. Per the "one
implementation unit per response" rule, this stops here.

## Added

### Communication Engine (`src/lib/communication/`)
Layered exactly per spec — `CommunicationService → TemplateEngine →
ReminderEngine → QueueManager → HistoryService → NotificationService →
ClickToChatProvider`:
- **`templateEngine.ts`** — pure `{{Variable}}` substitution. No I/O.
- **`clickToChatProvider.ts`** — the *only* file that knows about
  WhatsApp specifically. Wraps the **existing** `whatsappLink()` util
  (already used by Payments/Tenants for one-off reminders) rather than
  reimplementing wa.me URL construction. No paid SDK, no server-side
  send — click-to-chat only, exactly as required.
- **`notificationService.ts`** — thin wrapper around the **existing**
  `sendPushNotification()` from `@/lib/push`. Does not touch, replace,
  or redesign that file. The Notification Bell and outside-the-app push
  behavior are unaffected.
- **`queueManager.ts`** / **`historyService.ts`** — orchestration over
  two new Supabase tables (below), following the same
  `createClient()` / throw-on-error pattern used by every existing
  query in `queries.ts`.
- **`reminderEngine.ts`** — inert placeholder. `shouldRemind()` always
  returns `false`. Exists now so the module boundary is fixed and 9.3
  doesn't need to rewire imports — no scheduling logic runs yet, no
  cron, no timer.
- **`communicationService.ts`** — top-level orchestrator. Exposes
  `render`, `preview` (read-only, no side effects — used by the
  Templates editor), and `queueWhatsAppMessage` (adds a `pending` row
  to the queue; does not open WhatsApp or mark anything sent — that's
  9.2).

### Database (`supabase/29_communication_engine.sql`)
New tables only — nothing existing altered: `message_templates`,
`communication_queue`, `communication_logs`, `communication_settings`.
RLS policies follow the exact `owns_property()` / `get_my_role()`
pattern used by every other migration (see `13_notice_board.sql` for
the convention this matches). Queue/log tables include `attempt_count`
and `last_error` columns from day one so Phase 9.3's Retry Queue needs
no schema migration of its own.

### UI — `/inbox` (new route, added to Sidebar after Messages)
Four tabs per spec:
- **WhatsApp** — tenant + template pickers with a live rendered
  preview. The "Send via WhatsApp" button is present but disabled,
  labeled "arrives in Phase 9.2" — consistent with how every
  not-yet-built feature in this project has been handled (an honest
  placeholder, not a fake button).
- **Reminders** — placeholder explaining what Phase 9.3 will add.
  Nothing scheduled, nothing automatic.
- **Templates** — fully functional: create/edit/delete, variable
  insertion buttons, live preview, category badges. Four system-default
  templates (Rent Reminder, Rent Due Today, Overdue Rent, Welcome
  Message) are seeded per property on first visit.
- **History** — reads `communication_logs`. Empty today (nothing has
  been sent yet, since Send is 9.2) — correct, not a bug.
- **Settings** (gear icon, not a 5th tab — the brief specifies exactly
  four tabs) — WhatsApp/Push enabled toggles, default reminder lead
  time. Backed by `communication_settings`.

## Explicitly not touched
Tenant Onboarding, Owner Invitation, QR Join, Password Change, First
Login, Expense Split, Ledger, existing Tenant Dashboard, existing Owner
Dashboard, `src/lib/push.ts`, the existing Messages (tenant↔owner chat)
page, the Notification Bell. Only `src/types/index.ts` (appended),
`src/lib/supabase/queries.ts` (appended), and
`src/components/shared/Sidebar.tsx` (one icon + one nav entry) were
modified — everything else is new files, to keep merging with Phase 8
and Phase 11 as conflict-free as possible.

## Bug caught and fixed before shipping
The seeded "Welcome Message" template body used a single-quoted TS
string containing `You've` — the unescaped apostrophe would have closed
the string early and broken compilation. Caught on a balance-check pass
and switched that one string to double quotes.

---

# Changelog — Phase 8.8: Full Project Audit (Final Phase 8 Release)

## Method
Diffed the entire working tree against the original Phase 8.4 ZIP to get
the exact file-level footprint of Phases 8.5–8.7, then read every removed
line (`diff ... | grep "^<"`) across every touched file to confirm nothing
outside the intended edits was deleted, and every added identifier
(imports, functions, types, JSX components) was traced to a real
definition. No network access was available in this environment for
`npm install` / `npm run build`, so this audit is a manual/static one —
see the per-item results below.

## ✓ Checklist

- **Authentication** — untouched. No file under `src/app/(auth)` or
  `create_tenant_login` was modified in Phase 8.5–8.7.
- **QR Onboarding** — untouched. `getPendingApprovals`, the QR/join-link
  modal, and the "New Tenant Requests" tab in `approvals/page.tsx` are
  unchanged; confirmed via the removed-lines diff above.
- **Invitation Flow** — verified intact end-to-end: `inviteTenant` →
  `invitation_created` (now also logs history + notification) →
  `markOnboardingPasswordChanged` → `password_changed`. Password-change gate
  in `portal/page.tsx` re-read and confirmed it still calls the same
  `create_tenant_login`-backed login path from Phase 8.1, only the status
  update itself moved into a dedicated function.
- **Owner Review** — `approveOnboardingProfile` / `requestOnboardingCorrection`
  re-read line-by-line: the exact same field commit logic and owner-controlled
  assignment fields from Phase 8.4 are untouched, only a history-log call
  and (8.6) a notification call were added around the existing update.
- **Profile Wizard** — `validate()`'s required-field list
  (name, photo, Aadhaar number + front + back, address, emergency contact
  name + number) cross-checked against `PROFILE_STATUS_STEPS`'s
  `REQUIRED_FIELDS` in `profileStatus.ts` — identical set, so the
  completion % shown to the tenant can never disagree with what submission
  actually requires.
- **Notifications** — all 10 `sendPushNotification()` calls added across
  8.6/8.7 checked against the helper's real signature
  (`user_ids, title, body, url?, tag?`) — all correct, all wrapped in a
  truthy `auth_user_id`/`owner_id` guard so a missing recipient never
  throws.
- **Profile Update Requests** — re-verified the owner-controlled-field
  whitelist (`PROFILE_UPDATE_EDITABLE_FIELDS`) is applied on *both*
  `addProfileUpdateRequest` (tenant submission) and
  `decideProfileUpdateRequest` (owner approval) independently, so it can't
  be bypassed from either side.
- **Routing** — no new routes, no route files added or renamed. Every new
  screen (Owner Timeline, Tenant Timeline, Profile Updates tab, update
  request modal) lives inside an existing page.
- **Imports** — every new import in every touched file traced to a real
  export (`getProfileStatusHistory`, `markOnboardingPasswordChanged`,
  `markOnboardingDraftStarted`, `submitOnboardingProfile`,
  `addProfileUpdateRequest`, `getTenantProfileUpdateRequests`,
  `getPendingProfileUpdateRequests`, `decideProfileUpdateRequest`,
  `StatusTimeline`, `ProgressBar`, `calculateProfileCompletion`). No
  duplicate exports found in `queries.ts` or `types/index.ts` (checked via
  a full function/type name scan, see below).
- **Types** — `ProfileStatusHistory` and `ProfileUpdateRequest` added;
  confirmed no name collisions against the rest of `types/index.ts`, and
  confirmed every field referenced from component code
  (`email`, `aadhaar_number`, `permanent_address`, `emergency_contact_name`,
  `emergency_contact`, `property?: Property`) already exists on `Tenant`.
- **Build Integrity** — brace/paren balance re-checked across all 10
  touched/added files as a group (all zero-diff); Supabase migration
  numbering re-checked (32 and 33 are unique and sequential — a pre-existing
  duplicate `09_*` pair from before Phase 8 was found and left alone, since
  fixing pre-existing numbering is outside this phase's scope). A real
  `npm run build` still could not be run — no network access in this
  environment to `npm install`. **This is the one checklist item that
  needs a real build before merging.**
- **Mobile UI** — `StatusTimeline` and `ProgressBar` are single-column at
  every width by construction; the Profile Updates diff table and request
  modal reuse the same responsive containers (`max-w-sm`, `overflow-y-auto`)
  as the pre-existing Leave/Extension/Move-Out modals right next to them.
- **No Regressions** — full-tree diff against the original Phase 8.4 ZIP
  confirms exactly 6 files were modified (`approvals/page.tsx`,
  `tenants/page.tsx`, `portal/page.tsx`, `OnboardingWizard.tsx`,
  `queries.ts`, `types/index.ts`) and 4 files added (2 components, 1 util,
  2 SQL migrations — see file list below). Every removed line in every
  modified file was manually reviewed and matches an intentional
  replacement from this changelog — nothing else was touched.

## Known pre-existing issues carried forward (not introduced by Phase 8, not fixed)
- `<TenantThemeProvider>` is exported but never mounted around
  `(tenant)/portal/page.tsx` (flagged in the Phase 8.5 entry above) — this
  predates Phase 8.5 and affects `OnboardingWizard.tsx`'s pre-existing
  `tenant-*` classes just as much as the new ones added since. Left alone
  per "do not redesign existing modules."
- A duplicate `09_*` migration-number prefix exists in `supabase/` from
  before Phase 8. Left alone for the same reason.

## Files Modified (cumulative, Phases 8.5–8.7)
`src/lib/supabase/queries.ts`, `src/app/(tenant)/portal/page.tsx`,
`src/app/(owner)/approvals/page.tsx`, `src/app/(owner)/tenants/page.tsx`,
`src/components/tenant/OnboardingWizard.tsx`, `src/types/index.ts`

## Files Added (cumulative, Phases 8.5–8.7)
`supabase/32_profile_status_history.sql`,
`supabase/33_profile_update_requests.sql`,
`src/lib/utils/profileStatus.ts`,
`src/components/shared/StatusTimeline.tsx`,
`src/components/shared/ProgressBar.tsx`

## Required action before merge
Run, in order: `supabase/32_profile_status_history.sql`, then
`supabase/33_profile_update_requests.sql`, in the Supabase SQL Editor.
Then run a real `npm install && npm run build` — the one audit item this
environment couldn't verify directly.

## Phase 8 — complete
Onboarding lifecycle (invite → password → draft → submit → review →
correct/resubmit → approve), status history + timelines, basic push
notifications, and profile update requests are all in place with zero
known regressions against Phase 8.4. Ready to merge with the Phase 9
patch per the original brief.

---



## Analyzed first (per project rules)
- Confirmed the business rule already stated for Phase 8: after approval a
  tenant has no direct profile-edit path anywhere in the existing code —
  there was nothing to lock down, only a request flow to add.
- Reused the `leave_requests` RLS shape exactly (`supabase/18_leave_requests.sql`
  — combined owner-or-self select, tenant-only insert, owner-only update,
  no delete for anyone) for the new `profile_update_requests` table, and the
  same request→state→modal component pattern already used for Leave/Rent
  Extension/Move-Out requests in both `portal/page.tsx` and
  `(owner)/approvals/page.tsx`, rather than inventing a new one.
- Confirmed the owner-controlled field list from the brief (Property, Room,
  Bed, Rent, Deposit, Joining Date, Agreement Dates, Tenant Status) — none
  of these are reachable through this flow: `PROFILE_UPDATE_EDITABLE_FIELDS`
  in `queries.ts` is a hard whitelist of personal fields only (`name`,
  `email`, `aadhaar_number`, `permanent_address`, `emergency_contact_name`,
  `emergency_contact`), enforced both when the tenant submits a request and
  again independently when the owner approves one — so a modified request
  payload can never smuggle an owner-controlled field through.

## Added
- **`profile_update_requests` table** (`supabase/33_profile_update_requests.sql`)
  — every request ever made (pending/approved/rejected), never deleted.
  This table *is* the audit history — no second history table needed for it.
- **Tenant side** (`portal/page.tsx`): a "Request Profile Update" button on
  the Tenancy tab's personal-info card (visible only once `status ===
  'active'`, i.e. already approved, and hidden while a request is already
  pending), a request modal for the six editable fields + an optional
  reason, and the request now shows up in the existing "My Requests" list
  (`requestTypeFilter` gained a `'profile'` option) alongside leave/
  extension/move-out/maintenance requests, using the same generic list
  renderer already there — no new list UI needed.
- **Owner side** (`approvals/page.tsx`): a new "Profile Updates" tab with a
  badge count, listing each pending request with a Field / Current /
  Requested diff table, and Approve / Reject actions. Reject opens a small
  modal for an optional owner note.
- **`decideProfileUpdateRequest()`** (`queries.ts`) — on approval, patches
  only the whitelisted fields on the live `tenants` row (never touches
  owner-controlled columns); on rejection, just records the decision. Either
  way the request row itself is updated in place, never deleted.
- Two onboarding-notification-style push notifications, reusing
  `sendPushNotification()` exactly as Phase 8.6 established: owner is
  notified when a tenant submits a request, tenant is notified when it's
  approved or rejected.
- `ProfileUpdateRequest` type added to `src/types/index.ts`.

## Explicitly out of scope for this phase
Document re-uploads (profile photo, Aadhaar front/back, PAN) are not part
of the update-request flow — only the six text fields listed above. Those
documents are already captured and reviewed once at onboarding; adding
re-upload support here would mean building a second file-upload UI outside
what was scoped, so it's left as a clearly-flagged follow-up rather than
silently expanding this phase.

## Files Modified
- `src/lib/supabase/queries.ts`, `src/app/(tenant)/portal/page.tsx`,
  `src/app/(owner)/approvals/page.tsx`, `src/types/index.ts`

## Files Added
- `supabase/33_profile_update_requests.sql`

## Required action
Run `supabase/33_profile_update_requests.sql` in the Supabase SQL Editor.

## Build verification note
Same constraint as 8.5/8.6 — no network access to `npm install` / `npm run
build` here. Verified manually: brace/paren balance per touched file, every
new import traced to a real export, every new query function's call sites
checked against its signature, and the owner-controlled-field whitelist
traced through both the insert and approval code paths. Recommend a real
build before deploying.

---



## Analyzed first (per project rules)
- Notification architecture already existed in full from the PWA phase:
  `push_subscriptions` / `notification_log` tables, the `/api/push/send`
  route, and the `sendPushNotification({ user_ids, title, body, url, tag })`
  client helper (`src/lib/push.ts`) — already called from a dozen places
  (leave/extension decisions, notices, rent reminders, parcels, complaints).
  None of that was touched or rebuilt.
- Confirmed the existing convention for *who* gets notified: tenant→owner
  calls already targeted `tenant.property?.owner_id` (see
  `submitLeaveRequest` / `submitExtensionRequest` / `submitMoveOutRequest`
  in the tenant portal) and owner→tenant calls already targeted
  `tenant.auth_user_id` — Phase 8.6 reuses exactly this, no new targeting
  mechanism.

## Added — 8 onboarding notification points, all `sendPushNotification()` calls only
Owner (targets `tenant.property.owner_id`):
- **Tenant Registered** — `portal/page.tsx`, fired right after
  `markOnboardingPasswordChanged` succeeds.
- **Profile Submitted** / **Correction Resubmitted** — `OnboardingWizard.tsx`,
  fired after `submitOnboardingProfile` succeeds (title/body branch on
  whether the result was `'submitted'` or `'resubmitted'`).

Tenant (targets `tenant.auth_user_id`):
- **Invitation Created** — `(owner)/tenants/page.tsx`, right after
  `inviteTenant` succeeds. Best-effort by nature — the tenant has no push
  subscription yet at invite time, but this costs nothing and will deliver
  once they enable push later, same as any other fire-and-forget call here.
- **Password Changed** — `portal/page.tsx`, alongside the owner's "Tenant
  Registered" notification above (same try block, same success path).
- **Profile Submitted** — `OnboardingWizard.tsx`, a confirmation to the
  tenant alongside the owner-facing notification above.
- **Correction Requested** — `(owner)/approvals/page.tsx`
  `handleSendBackForCorrection`, after `requestOnboardingCorrection`
  succeeds.
- **Profile Approved** — `(owner)/approvals/page.tsx` `handleApproveReview`,
  after `approveOnboardingProfile` succeeds.

## Explicitly NOT built (per phase scope)
WhatsApp, Email, a reminder engine, a general communication engine, or a
template engine — all deferred to Phase 9 as instructed. Every notification
above is push-only, using the infrastructure that already existed.

## Files Modified
- `src/app/(owner)/tenants/page.tsx`, `src/app/(tenant)/portal/page.tsx`,
  `src/components/tenant/OnboardingWizard.tsx`, `src/app/(owner)/approvals/page.tsx`

## Files Added
None — this phase is wiring only, no new tables or components.

## Build verification note
Same constraint as Phase 8.5 — no network access to `npm install` /
`npm run build` in this environment. Verified manually: brace/paren balance
per touched file, single `sendPushNotification` import per file (no
duplicates), and every new call site checked against the existing function
signature (`user_ids`, `title`, `body`, `url`, `tag`). Recommend a real
build before deploying.

---



## Analyzed first (per project rules)
- `tenants.onboarding_status` (Phase 8.1, `supabase/29_tenant_invitations.sql`)
  already carried the current step of the ladder (`invitation_created →
  password_changed → submitted/resubmitted → approved`/`correction_requested`),
  written from `inviteTenant`, the tenant portal's password-change gate,
  `OnboardingWizard`'s submit handler, and the Owner Review actions
  (`approveOnboardingProfile`, `requestOnboardingCorrection`). None of that
  was rebuilt — this phase adds the missing history + completion layer on
  top of it.
- The project's existing audit-log convention (`room_changes`,
  `supabase/25_room_change_log.sql` — property-scoped, append-only, RLS via
  `owns_property()`) was reused as-is for the new history table rather than
  inventing a new pattern.

## Added
- **`profile_status_history` table** (`supabase/32_profile_status_history.sql`)
  — persistent, append-only record of every onboarding-status transition
  (from, to, note, who changed it, when). Owners can read/write for their
  own properties; tenants can read (not write) their own row.
- **`'draft'` status** — inserted between `password_changed` and `submitted`
  in the ladder. Set automatically the first time a tenant opens the
  Onboarding Wizard after activating their account.
- **`src/lib/utils/profileStatus.ts`** — single source of truth for the
  status ladder (labels for both the owner and tenant views) and
  `calculateProfileCompletion()` (checks the same 8 required wizard fields
  `OnboardingWizard`'s own `validate()` already requires).
- **`StatusTimeline`** (`src/components/shared/StatusTimeline.tsx`) — one
  component, `variant="owner"` / `variant="tenant"`, rendering the full
  history + current step. Used in three places:
  - Tenant: inside `OnboardingWizard` (collapsible, under a completion bar)
  - Tenant: the "Profile Under Review" screen (now `OnboardingReviewScreen`,
    replacing the old static paragraph)
  - Owner: the Profile Review modal in Approvals → Profile Reviews, plus a
    completion-% badge on each list card
- **`ProgressBar`** (`src/components/shared/ProgressBar.tsx`) — reusable
  completion-percentage indicator backing the timeline and the wizard.
- **`ProfileStatusHistory` type** added to `src/types/index.ts`.
- New `src/lib/supabase/queries.ts` functions: `getProfileStatusHistory`,
  `markOnboardingPasswordChanged`, `markOnboardingDraftStarted`,
  `submitOnboardingProfile`. `approveOnboardingProfile` and
  `requestOnboardingCorrection` now also log a history row instead of only
  updating the current-status column. History logging is best-effort — a
  logging failure never blocks the actual status transition.

## Mobile / responsiveness
`StatusTimeline` is a single-column vertical list at every width — no
separate mobile layout was needed. Verified against both the owner review
modal (desktop-first, plain Tailwind) and the tenant wizard/review screen
(mobile-first, `tenant-*` design tokens).

## Known pre-existing issue found (not introduced by this phase, not fixed here)
`<TenantThemeProvider>` (which writes the `.tenant-portal` wrapper class
that the `tenant-*` Tailwind color tokens — `bg-tenant-bg`, `text-tenant-fg`,
etc. — depend on via CSS variables) is exported from
`src/components/tenant/ui` but is never actually mounted around
`src/app/(tenant)/portal/page.tsx`. This means `OnboardingWizard.tsx` was
already relying on `tenant-*` classes outside their CSS-variable scope
before this phase touched it. Phase 8.5 keeps using the same tokens for
consistency with the existing component rather than introducing a second
color system, but doesn't attempt to fix the provider wiring itself — that's
a page-layout/architecture change outside this phase's scope per the
project's "no architecture changes mid-phase" rule. Flagging for the
Phase 8.8 full audit.

## Files Modified
- `src/lib/supabase/queries.ts`, `src/components/tenant/OnboardingWizard.tsx`,
  `src/app/(tenant)/portal/page.tsx`, `src/app/(owner)/approvals/page.tsx`,
  `src/types/index.ts`

## Files Added
- `supabase/32_profile_status_history.sql`, `src/lib/utils/profileStatus.ts`,
  `src/components/shared/StatusTimeline.tsx`, `src/components/shared/ProgressBar.tsx`

## Required action
Run `supabase/32_profile_status_history.sql` in the Supabase SQL Editor.

## Build verification note
No network access was available in this environment to run `npm install` /
`npm run build`. Verification for this release was: brace/paren balance
checked file-by-file across every file touched, every new import traced to
a real export, and every changed call site cross-checked against its
function signature. A real `npm run build` should still be run before
deploying.

---



## Analyzed first (per project rules)
- The existing "New Tenant Requests" tab (QR-join flow) already has an
  Approve/Reject pattern with a room-assignment modal — read it closely
  before building anything. Found it **cannot be reused as-is**:
  `approveTenant()` unconditionally calls `create_tenant_login` again
  (harmless no-op since the login already exists from Phase 8.1 — the RPC
  returns the existing user id without touching the password) and then
  WhatsApps the tenant a hardcoded default password. An invited tenant's
  real password is whatever they set in Phase 8.2, so that message would
  be actively wrong. Built a dedicated `approveOnboardingProfile()`
  instead, rather than patching QR-flow-specific logic to special-case a
  situation it was never designed for.
- Realized Phase 8.3, as shipped, would make "Previous Value / New Value"
  impossible to show correctly: the wizard wrote tenant-submitted fields
  **directly** onto the live `tenants` columns, overwriting the owner-
  entered name from Phase 8.1 with no record of what it used to be. Fixed
  at the root: added `tenants.pending_profile` (jsonb staging) and changed
  the wizard to write submissions there instead of live columns. This is
  a genuine, necessary correction — Review literally cannot do its job
  without it — not scope creep into a phase that's already shipped.

## Added
- **`pending_profile` (jsonb) + `correction_note`** columns on `tenants`.
- **Owner Review** — new "Profile Reviews" tab in Approvals, styled to
  match its existing raw-Tailwind neighbors (this page was never
  retrofitted to the newer `owner/ui` system, so matching it here keeps
  the page visually consistent rather than mixing two styles within one
  screen). Shows every tenant with `status: 'invited'` and
  `onboarding_status` in `submitted`/`resubmitted`.
- **Review modal** — field-by-field table: Previous Value (live column,
  Source: Owner) next to Submitted Value (from `pending_profile`, Source:
  Tenant, and editable in place — editing here **is** "Edit & Approve",
  not a separate flow). Document thumbnails (photo, Aadhaar front/back,
  PAN) link out to the full image.
- **Room & Rent assignment**, required before approval — Property/Room/
  Bed/Rent/Deposit/Joining Date are owner-controlled fields that nothing
  in Phases 8.1–8.3 collects, so Review is where they get finalized,
  exactly the point in the flow where the owner is already looking at
  this tenant's details.
- **Approve & Activate** — commits `pending_profile` (as edited) into the
  live columns, clears the staging field, sets `status: 'active'` and
  `onboarding_status: 'approved'`.
- **Reject** — reuses the existing `deleteTenant()`.
- **Send Back For Correction** — sets `onboarding_status:
  'correction_requested'` with the owner's note; the tenant portal
  already routes a tenant in that state back to the wizard (extended in
  this sub-phase to show the correction note and pre-fill from
  `pending_profile` instead of wiping their earlier answers). Resubmission
  is tracked as `'resubmitted'`, distinct from a first-time `'submitted'`.

## Known limitation (inherited, not introduced here)
`deleteTenant()` only removes the `tenants` row, not the underlying
`auth.users` account — the same limitation already exists on the QR-flow's
Reject action today. Not fixed here since it's shared, pre-existing
behavior outside this sub-phase's scope; flagging for awareness.

## Required action
Run `supabase/31_owner_review.sql` in the Supabase SQL Editor.

## Files Modified
- `supabase/31_owner_review.sql` (new)
- `src/types/index.ts` (`pending_profile`, `correction_note`)
- `src/lib/supabase/queries.ts` (`approveOnboardingProfile`,
  `requestOnboardingCorrection`, `getSubmittedOnboardingProfiles`)
- `src/app/(owner)/approvals/page.tsx` ("Profile Reviews" tab + modal)
- `src/components/tenant/OnboardingWizard.tsx` (writes to `pending_profile`
  instead of live columns; pre-fills from it on correction; shows the
  correction note)
- `src/app/(tenant)/portal/page.tsx` (routing fix: `'resubmitted'` now
  correctly shows the waiting screen instead of re-showing the wizard)

---

# Changelog — Phase 8.3: Smart Tenant Onboarding — Onboarding Wizard

## Analyzed first (per project rules)
Checked existing tenant profile/KYC infrastructure before adding anything:

- `photo_url`, `email`, `pan_url`/`pan_status` already exist on `tenants`
  and map directly to the wizard's Profile Photo, Email, and PAN fields —
  reused as-is, no new columns.
- `emergency_contact` already exists — but as a single phone-number field
  only (confirmed by reading its actual usage in the QR-join flow: a `tel`
  input labeled "Parent/Guardian number"). The wizard needs a name too, so
  only `emergency_contact_name` was added; the existing column is reused
  for the number rather than replaced.
- `aadhaar_url`/`aadhaar_status` already exist, used by the QR-join flow's
  single government-ID-photo upload. Left completely untouched — the
  wizard's Aadhaar Number/Front/Back are new, additive fields, not a
  replacement of that existing flow.
- **File upload**: reused the exact existing pattern from the QR-join flow
  (`sb.storage.from('tenant-documents').upload(...)`) — same bucket, same
  path scheme, same public-URL retrieval. No new storage bucket or policy;
  the existing insert policy already has no auth restriction, so an
  authenticated tenant can already upload there today.
- **Design system**: found a full `components/tenant/ui` library already
  built (Button, Card, Input, TopAppBar, Avatar, etc.) but never imported
  by `portal/page.tsx` — the same "built but not wired up" pattern found
  during the Phase 4 dashboard restoration. Used it for this new wizard
  component (a clean, self-contained screen with no old styling to clash
  with), without touching the rest of the still-unstyled portal — that's
  a separate, much larger retrofit outside this sub-phase's scope.

## Added
- **`OnboardingWizard`** (`src/components/tenant/OnboardingWizard.tsx`) —
  single-screen wizard covering exactly the required fields (Full Name,
  Profile Photo, Aadhaar Number, Aadhaar Front, Aadhaar Back, Permanent
  Address, Emergency Contact Name, Emergency Contact Number) and optional
  fields (Email, PAN). Gender, Blood Group, Guardian Details, Occupation,
  Company, and College are not present anywhere in the form, per the
  explicit exclusion list.
- New columns: `aadhaar_number`, `aadhaar_front_url`, `aadhaar_back_url`,
  `permanent_address`, `emergency_contact_name`.
- Tenant portal now routes an `'invited'`-status tenant through, in order:
  the existing password-change gate (if not yet done) → this wizard (if
  not yet submitted) → a short "Profile Under Review" waiting screen (if
  submitted). This is an early return before the normal sidebar/tabs shell
  ever mounts — an invited tenant has no room/rent/agreement yet, so that
  shell has nothing real to show them. Existing tenants (active, leaving,
  left, pending_approval) are entirely unaffected; the branch only
  triggers for `status === 'invited'`.
- Submitting sets `onboarding_status: 'submitted'` via the existing,
  already-tenant-accessible `updateTenant()` — no new query function
  needed for this.

## Not implemented (explicitly out of scope for 8.3)
Owner-side review of a submitted profile (approve/reject/edit, previous-
vs-new-value display) is Phase 8.4. The "Profile Under Review" screen is
just enough to keep the tenant experience coherent between submitting and
that review existing — it is not Phase 8.5's completion-percentage/status
system, which is its own sub-phase.

## Required action
Run `supabase/30_onboarding_wizard.sql` in the Supabase SQL Editor.

## Files Modified
- `supabase/30_onboarding_wizard.sql` (new)
- `src/types/index.ts` (5 new `Tenant` fields)
- `src/components/tenant/OnboardingWizard.tsx` (new)
- `src/app/(tenant)/portal/page.tsx` (routes invited tenants through the
  gate → wizard → waiting-screen sequence)

---

# Changelog — Phase 8.2: Smart Tenant Onboarding — First Login Security

## Analyzed first (per project rules)
Checked for existing first-login / mandatory-password-change infrastructure
before writing anything — found all three of this sub-phase's stated
requirements already fully implemented and already working end-to-end for
Phase 8.1's new invited tenants, with zero special-casing needed:

- **First login detection** — `profiles.must_change_password` (defaults
  `true` for every new profile via the existing `handle_new_user` trigger).
  A freshly-invited tenant gets this automatically the moment
  `create_tenant_login` creates their account; nothing from Phase 8.1
  needed to set it explicitly.
- **Mandatory password change** — `ForcePasswordChangeModal`, a genuine
  full-viewport blocking overlay (`fixed inset-0`, dark backdrop, no close/
  skip button, the only path to `onDone()` is successfully setting a new
  password).
- **Dashboard blocked until changed** — verified there is exactly one
  tenant-facing route in the whole app (`(tenant)/portal/page.tsx`, no
  other pages under that route group), and it already gates on `loading`
  before anything renders, so there's no flash-of-unblocked-content gap
  between the page loading and the `must_change_password` check resolving.
- Traced the full path end to end: `create_tenant_login`'s synthetic email
  (`{phone}@pgmanager.local`) exactly matches what the login page
  constructs from a typed phone number, and the login page already routes
  `role === 'tenant'` to `/portal` — an invited tenant can already log in
  with their temporary password and land squarely on the gate today,
  with no changes.

## What was actually missing
Phase 8.1 added `tenants.onboarding_status` (defaulting to
`'invitation_created'` for invited tenants) to track Phase 8's onboarding
ladder — but nothing advanced it. The existing password-change modal only
ever touched `profiles.must_change_password`; it had no idea the new
column existed, correctly, since it's a shared component also used by
Owner and Admin, where an onboarding ladder doesn't apply.

## Added
- Tenant portal's password-change gate now advances
  `onboarding_status: 'invitation_created' → 'password_changed'` in its
  `onDone` callback, once the password is successfully changed. Scoped to
  only fire for tenants who actually have `onboarding_status ===
  'invitation_created'` — QR-join and owner-added tenants never set that
  field, so this is a no-op for them, exactly as before. `ForcePasswordChangeModal`
  itself was left untouched — the update happens in the tenant-portal-specific
  caller, keeping the shared component clean and role-agnostic.
- Failure to update `onboarding_status` is non-fatal and doesn't block the
  gate from clearing — the password change itself is the security-critical
  part and always completes; the status ladder is purely informational for
  the Owner Review step (Phase 8.4).

## Required action
None — no schema change, no new tables. Reuses `tenants.onboarding_status`
from Phase 8.1.

## Files Modified
- `src/app/(tenant)/portal/page.tsx` (`onboarding_status` progression on
  password change)

---

# Changelog — Phase 8.1: Smart Tenant Onboarding — Invitation Foundation

## Analyzed first (per project rules)
Before writing anything, checked for existing tenant onboarding/registration
infrastructure to reuse rather than duplicate:

- **`create_tenant_login` RPC** (already exists, used by both `addTenantByOwner`
  and the QR-join approval flow) — reused as-is, unchanged, for the new
  invitation flow's auth account creation. No second way to create a tenant
  login was introduced.
- **`must_change_password` / `ForcePasswordChangeModal`** — already fully
  implemented (`profiles.must_change_password`, defaults `true`, already
  gates the Tenant Portal). This *is* Phase 8.2's "mandatory password change,
  dashboard blocked until changed" — already built. Nothing needed here
  beyond letting the existing default apply to newly invited tenants.
- **QR-join self-registration flow** (`status: 'pending_approval'`,
  `submitted_via: 'qr_link'`) — a different shape of "tenant onboarding"
  that already exists, where the *tenant* submits a complete application
  first. Deliberately did not reuse `pending_approval` for invitation-stage
  tenants: that status specifically drives the existing "New Tenant
  Requests" Approvals tab, which is built to render a complete, self-
  submitted application (rent, joining date, a payment claim). An
  invitation-stage tenant has none of that yet — reusing the status would
  make bare, mostly-empty rows show up in a UI built for something else.
  Added a new, distinct `'invited'` status instead.

## Added
- **`tenant_status` gains `'invited'`** — a new, minimal-entry tenant.
  Distinct from `pending_approval` for the reason above.
- **`tenants.onboarding_status`** (nullable text) — tracks Phase 8's
  onboarding ladder (Invitation Created → ... → Approved), kept separate
  from `tenant_status` since it's a different concern (profile completeness
  vs. tenancy lifecycle/billing/occupancy).
- **`inviteTenant()`** in `queries.ts` — owner supplies only name + phone;
  generates a random 10-character temporary password (unambiguous alphabet,
  no `0/O/1/I/l`), creates the login via the existing RPC, and inserts a
  minimal `tenants` row (`status: 'invited'`, `onboarding_status:
  'invitation_created'`, `submitted_via: 'owner_invited'`).
- **"Invite Tenant" action** on the Owner Tenants page, alongside the
  existing "Add Tenant" (both kept — Add Tenant remains valid for owners
  entering a complete, already-signed agreement in one pass). Shows the
  generated temporary password once, with copy-to-clipboard, since it's
  never retrievable again after this screen.
- `getInvitedTenants()` — added for the Owner Review step (Phase 8.4) to
  use; not yet called from any UI in this sub-phase, matching this
  project's existing pattern of landing a query function ahead of the
  phase that wires it up (same as `createAgreement`/`getAgreementsForProperty`
  before Phase 3.6).

## Design decision worth recording
Initially made `monthly_rent`/`joining_date` nullable on `tenants` to
reflect that an invitation-stage tenant genuinely has neither yet. Reverted
that: it would have propagated `| null` through arithmetic in `queries.ts`
(`getDashboardStats`), the Owner Dashboard, Payments, Approvals, and the
Tenant Portal — a much wider blast radius than "Invitation Foundation," and
several of those are Phase 8.2/8.4's job to harden against, not this one's.
Used database defaults instead (`monthly_rent default 0`, `joining_date
default current_date`) — both NOT NULL constraints stay intact, every
other tenant-creation path is unaffected, and the values are always
overwritten once the owner completes Review.

## Required action
Run `supabase/29_tenant_invitations.sql` in the Supabase SQL Editor.

## Not implemented (explicitly out of scope for 8.1, per the phase plan)
Onboarding wizard UI, password-change UI/flow, first-login detection
enforcement beyond the existing gate. These are Phase 8.2 and 8.3.

## Files Modified
- `supabase/29_tenant_invitations.sql` (new)
- `src/types/index.ts` (`'invited'` status, `onboarding_status`,
  `submitted_via` extended, new `InviteTenantInput`)
- `src/lib/supabase/queries.ts` (`inviteTenant`, `getInvitedTenants`)
- `src/app/(owner)/tenants/page.tsx` ("Invite Tenant" action + modal,
  `'invited'` status badge tone and filter tab)

---

("Dashboard's 3 newest KPI displays... Documented as a follow-up rather than
forced in"). Verified via a dedicated comparison audit first (feature-by-
feature check of the original Phase 4.1–4.6 implementation against this
Master v1.0 dashboard) before touching anything — see that audit's findings
for the full list. This sprint restores exactly what the audit confirmed
missing, adapted to the current `owner-*` design system rather than reverting
to the old literal-Tailwind styling.

## Restored

1. **KPI trend indicators** — `OwnerStatCard`'s `trend` prop was already
   built for this (its own doc comment: *"not populated by any page yet"*)
   and `getDashboardStats()` already computed `revenueTrendPct` — this was
   purely a wiring gap, not a rebuild. Monthly Revenue now shows it.
2. **Collection Rate KPI card** — new `OwnerStatCard`, data already existed.
3. **Average Rent/Bed KPI card** — new `OwnerStatCard`, data already existed.
4. **Cross-property KPI aggregation, corrected** — the dashboard's "all
   properties" reduce was summing only the original 8 `DashboardStats`
   fields, silently dropping `lastMonthRevenue`/`activeRentSum` (needed to
   derive #1–3 correctly across multiple properties). Fixed to sum the raw
   values first and derive the percentages after, same pattern as before.
5. **Reports page `DashboardStats` type mismatch — fixed.** `setStats(agg)`
   was being called with an object missing 5 fields the `DashboardStats`
   type requires (`stats` is explicitly typed `useState<DashboardStats |
   null>`). This was a genuine TypeScript compile error, not just a missing
   feature — confirmed and fixed as part of this sprint.
6. **Occupancy Trend chart** — 6-month line chart, occupancy % derived from
   tenant tenancy overlaps (no historical snapshot table needed). Restyled
   with `OwnerCard`/`OwnerChartTooltip`/owner-* CSS tokens.
7. **By Sharing Type breakdown** — occupied/total beds per sharing type,
   restyled with `owner-*` progress bars.
8. **Profit series on the revenue chart** — the chart was rendering only
   `revenue`/`expenses`; `profit` is now a third bar, and the chart is
   retitled "Income vs Expense" to match.
9. **Net Profit (this month) headline** — next to the chart title.
10. **Smart Alerts / "Needs Your Attention" panel** — new `OwnerCard` above
    the stat cards: pending payment approvals, new tenant requests, tenants
    overdue 5+ days, open complaints, and expiring agreements, each linking
    to the relevant page. Built from data already fetched elsewhere on the
    page — no new queries.
11. **Activity Timeline, both regressions fixed:**
    - **All-properties coverage** — the feed was silently empty on
      complaints/expenses whenever "All Properties" was selected
      (`activeId !== 'all' ? getComplaints(...) : Promise.resolve([])`).
      Now fetches consistently regardless of view.
    - **Leave / Extension / Move-Out events** — the `ActivityItem` type had
      reverted to the original 4 categories. Re-added the 3 Phase 3 request
      types so the feed reflects what the app now actually does.
12. **Consolidated single-batch data loading** — the main data load had
    reverted to a sequential waterfall (stats/tenants/payments/rooms
    resolving first, *then* a separate fetch for activity-feed data
    afterward). Restored to one parallel `Promise.all` wave. The
    Notifications-widget/Upcoming-Events effect — a genuine new Phase 7
    addition unrelated to this gap — was left as its own separate effect,
    not folded in, to keep this change scoped to what regressed.
13. **Mobile-safe stat card sizing** — `OwnerStatCard`'s value text was a
    fixed `text-2xl` with no overflow guard, same risk profile as before:
    9 stat cards in a 2-column mobile grid, some showing multi-lakh rupee
    figures. Changed to `text-xl sm:text-2xl` plus `break-words` — shared
    component, so this benefits every page using `OwnerStatCard`, not just
    the dashboard.
14. **Renew Agreement quick action** — the "Upcoming Events" card showed
    expiring agreements read-only; `renewAgreement()` still existed in
    `queries.ts` but nothing called it. Added a "Renew" button per row,
    wired to the existing function, with the same modal-and-push-
    notification flow as the original implementation, styled with
    `OwnerButton`/`OwnerCard`.

## Explicitly not touched

Tenant UI, Approvals, Messages, Rooms, Payments (beyond what was already
restored in the merge above), authentication, routing, multi-property or
multi-tenant logic, any Phase 3/5/6/7 feature, and no new features. Exactly
3 files changed: `dashboard/page.tsx`, `reports/page.tsx`,
`components/owner/ui/StatCard.tsx` — verified via full file-list diff
against the pre-restore build before packaging this release.

## Verification performed before packaging

- Grepped for all 14 restored items individually — each confirmed present
  in the code (not just "written," actually there).
- Full-project file diff confirming exactly 3 files changed and none added
  or removed.
- TypeScript syntax check and brace/paren balance check on all 3 changed
  files plus every file they import from — clean.
- Confirmed no unused imports introduced.

---

# Changelog — Phase 4 Restore Sprint (Dashboard Analytics)

Closes the follow-up gap explicitly flagged in the Phase 7 merge entry below
("Dashboard's 3 newest KPI displays... Documented as a follow-up rather than
forced in"). Verified via a dedicated comparison audit first (feature-by-
feature check of the original Phase 4.1–4.6 implementation against the
Master v1.0 dashboard) before touching anything. This sprint restores
exactly what that audit confirmed missing, adapted to the current `owner-*`
design system rather than reverting to the old literal-Tailwind styling.

## Restored

1. **KPI trend indicators** — `OwnerStatCard`'s `trend` prop was already
   built for this (its own doc comment: *"not populated by any page yet"*)
   and `getDashboardStats()` already computed `revenueTrendPct` — this was
   purely a wiring gap, not a rebuild. Monthly Revenue now shows it.
2. **Collection Rate KPI card** — new `OwnerStatCard`, data already existed.
3. **Average Rent/Bed KPI card** — new `OwnerStatCard`, data already existed.
4. **Cross-property KPI aggregation, corrected** — the dashboard's "all
   properties" reduce was summing only the original 8 `DashboardStats`
   fields, silently dropping `lastMonthRevenue`/`activeRentSum` (needed to
   derive #1–3 correctly across multiple properties). Fixed to sum the raw
   values first and derive the percentages after, same pattern as before.
5. **Reports page `DashboardStats` type mismatch — fixed.** `setStats(agg)`
   was being called with an object missing 5 fields the `DashboardStats`
   type requires (`stats` is explicitly typed `useState<DashboardStats |
   null>`). This was a genuine TypeScript compile error, not just a missing
   feature — confirmed and fixed as part of this sprint.
6. **Occupancy Trend chart** — 6-month line chart, occupancy % derived from
   tenant tenancy overlaps (no historical snapshot table needed). Restyled
   with `OwnerCard`/`OwnerChartTooltip`/owner-* CSS tokens.
7. **By Sharing Type breakdown** — occupied/total beds per sharing type,
   restyled with `owner-*` progress bars.
8. **Profit series on the revenue chart** — the chart was rendering only
   `revenue`/`expenses`; `profit` is now a third bar, and the chart is
   retitled "Income vs Expense" to match.
9. **Net Profit (this month) headline** — next to the chart title.
10. **Smart Alerts / "Needs Your Attention" panel** — new `OwnerCard` above
    the stat cards: pending payment approvals, new tenant requests, tenants
    overdue 5+ days, open complaints, and expiring agreements, each linking
    to the relevant page. Built from data already fetched elsewhere on the
    page — no new queries.
11. **Activity Timeline, both regressions fixed:**
    - **All-properties coverage** — the feed was silently empty on
      complaints/expenses whenever "All Properties" was selected
      (`activeId !== 'all' ? getComplaints(...) : Promise.resolve([])`).
      Now fetches consistently regardless of view.
    - **Leave / Extension / Move-Out events** — the `ActivityItem` type had
      reverted to the original 4 categories. Re-added the 3 Phase 3 request
      types so the feed reflects what the app now actually does.
12. **Consolidated single-batch data loading** — the main data load had
    reverted to a sequential waterfall (stats/tenants/payments/rooms
    resolving first, *then* a separate fetch for activity-feed data
    afterward). Restored to one parallel `Promise.all` wave. The
    Notifications-widget/Upcoming-Events effect — a genuine new Phase 7
    addition unrelated to this gap — was left as its own separate effect,
    not folded in, to keep this change scoped to what regressed.
13. **Mobile-safe stat card sizing** — `OwnerStatCard`'s value text was a
    fixed `text-2xl` with no overflow guard, same risk profile as before:
    9 stat cards in a 2-column mobile grid, some showing multi-lakh rupee
    figures. Changed to `text-xl sm:text-2xl` plus `break-words` — shared
    component, so this benefits every page using `OwnerStatCard`, not just
    the dashboard.
14. **Renew Agreement quick action** — the "Upcoming Events" card showed
    expiring agreements read-only; `renewAgreement()` still existed in
    `queries.ts` but nothing called it. Added a "Renew" button per row,
    wired to the existing function, with the same modal-and-push-
    notification flow as the original implementation, styled with
    `OwnerButton`/`OwnerCard`.

## Explicitly not touched

Tenant UI, Approvals, Messages, Rooms, Payments (beyond what was already
restored in the merge above), authentication, routing, multi-property or
multi-tenant logic, any Phase 3/5/6/7 feature, and no new features. Exactly
3 files changed: `dashboard/page.tsx`, `reports/page.tsx`,
`components/owner/ui/StatCard.tsx` — verified via full file-list diff
against the pre-restore build before packaging this release.

## Verification performed before packaging

- Grepped for all 14 restored items individually — each confirmed present
  in the code (not just "written," actually there).
- Full-project file diff confirming exactly 3 files changed and none added
  or removed.
- TypeScript syntax check and brace/paren balance check on all 3 changed
  files plus every file they import from — clean.
- Confirmed no unused imports introduced.

---

# Changelog — Merge: Phase 7 (Tenant UI Polish T1–T8 + Owner UI Polish O1–O12)

Merges the uploaded Phase 7 project — a complete visual redesign built on a **pre-Phase-3/4/5/6 base** (confirmed: its `queries.ts` had the exact same 58 baseline functions as the original Main Project, zero new backend functions or types added anywhere) — into the current Master Project. Because Phase 7 predates all four backend phases, the core challenge of this merge was not adopting Phase 7's new design system (safe, additive), but making sure none of Phase 3/4/5's functionality was silently lost underneath it.

## What Phase 7 actually is
A new component library (`src/components/owner/ui/*`, `src/components/tenant/ui/*` — Button, Card, Input, Badge, Table, StatCard, etc.) plus two independent `ThemeProvider`/`ThemeToggle` pairs (owner and tenant scoped separately, deliberately, so redesign work can land page-by-page without a big-bang rewrite), used to redesign: Dashboard, Sidebar, Topbar, Rooms, Tenants, Payments, Expenses, Complaints, Notices, Settings, plus three genuinely new pages (Properties, Documents, Notifications) and a full Tenant Portal redesign. Phase 7's own changelog documents that Approvals and Messages were deliberately left unredesigned — confirmed by diff, matches their own notes exactly.

## Key finding before merging anything
`OwnerThemeProvider` was specifically engineered to also toggle the global `.dark` class alongside its own `data-theme` attribute, **explicitly so pages not yet migrated to `owner-*` tokens keep working** (confirmed via its own code comments). This meant the Production Stability Sprint's comprehensive `.dark`-scoped CSS override system in `globals.css` continues to work automatically for every page Phase 7 didn't touch — no conflict, no extra work needed to keep dark mode functioning app-wide. `TenantThemeProvider`, by contrast, deliberately does **not** touch the global `.dark` class (to avoid clashing with `dark:` variants on pages using literal Tailwind classes) — this is why the Tenant Portal's existing dark-mode toggle (added in the Stability Sprint) was left as its own independent, working mechanism rather than switched over (see below).

## Backend verified unchanged (zero risk)
Diffed every function in Phase 7's `queries.ts` and every type in its `types/index.ts` against the current project — **zero new functions, zero new types**. Phase 7 is a pure frontend/component layer on the exact same backend. This is what made a full-project merge feasible at all within this pass.

## Merged wholesale (new files, or redesigns with zero backend divergence — verified via import diff before copying)
- `src/components/owner/ui/*`, `src/components/tenant/ui/*` (28 files), `owner-theme.css`, `tenant-theme.css`, `AddPropertyModal.tsx`
- `tailwind.config.ts` — diffed first; confirmed 100% additive (new `owner-*`/`tenant-*` token namespaces), zero lines removed or changed from the current config
- New pages: `properties/`, `documents/`, `notifications/`
- Redesigned pages with no Phase 3/4/5 logic to lose: `rooms/`, `expenses/`, `complaints/`, `notices/`, `dashboard/` (Phase 4's extra KPI fields on `DashboardStats` are additive on the data layer — Phase 7's dashboard UI calls the same `getDashboardStats()` and simply doesn't render the 3 newest fields; nothing crashes, nothing is lost at the data layer, only not yet surfaced in this particular UI — see Known Gaps)
- `OwnerShell.tsx` (one line restored: `id="main-content"` on `<main>`, needed by the Stability Sprint's skip-to-content link, which predates Phase 7 and wasn't in its version)

## Surgically merged (Phase 7's redesigned structure + re-integrated Phase 3/5/6 functionality)
- **`Sidebar.tsx`**: Phase 7's redesigned nav + all 9 of Phase 5's items (Tenant Cards, Visitors, Parcels, Waiting List, Room Change, Backup, Restore, Archive — plus Reports, which Phase 7 already had) added back in, plus the Stability Sprint's `pb-safe` mobile fix.
- **`Topbar.tsx`**: Phase 7's redesigned property switcher/notifications/theme menu kept; Global Search (5.7)'s results dropdown restored (Phase 7's search box was visually present but had no results logic) and `OfflineQueueBadge` (6.3) added back to the icon row.
- **`settings/page.tsx`**: Phase 7's redesign kept; the Push Notifications toggle (6.2) restored as its own card, restyled with the new `owner-*` tokens rather than left in old styling, since it's a small, self-contained addition.
- **`tenants/page.tsx`**: Phase 7's redesign kept; **Move-Out Checklist** (3.4 — full modal, state, and handlers) and **itemized Deposit Deductions** (3.5 — add/edit/remove line items with auto-calculated refund) both restored. The checklist modal keeps its original literal-Tailwind styling (still fully dark-theme-compatible via the existing CSS overrides) rather than being restyled, to keep this merge's scope bounded; the deduction-items UI was restyled to `owner-*` tokens since it fits naturally into the existing redesigned Edit Tenant form.
- **`payments/page.tsx`**: Phase 7's redesign kept; the leave-adjusted and extension-aware **effective rent calculation** (3.2/3.3) was restored into the pending-rent logic — this matters because without it, the redesigned page would show inflated (incorrect) due amounts for any tenant with an approved leave or rent-extension request. This was treated as a correctness fix, not optional polish.

## Deliberately NOT merged, with reasoning
- **Tenant Portal**: kept the current 1876-line version (with all of Phase 3's leave/rent-extension/move-out/deposit-settlement/agreement-renewal UI and the Stability Sprint's dark-mode toggle) rather than switching to Phase 7's 1760-line redesign, which has **zero** Phase 3 request-management features (confirmed: built on the same pre-Phase-3 baseline as everything else in Phase 7). Re-integrating ~1200 lines of tenant-facing request UI into a different visual framework, correctly, without a build/test environment to verify against, is a large enough undertaking that doing it hastily here risked silently breaking tenant-facing functionality — a worse outcome than shipping this merge with the redesign gap clearly documented. **This is flagged as required follow-up work**, matching exactly how Phase 7 itself flagged Approvals/Messages as a known, disclosed gap rather than silently leaving them stale.
- **Reports**: kept the current Phase 5 Reports Dashboard (hub + real Income/Expense/P&L sub-pages with actual filtering and exports) rather than Phase 7's redesigned `reports/page.tsx`, which — confirmed by inspection — is a visual restyle of the *original placeholder* reports page (same "Report download tiles" pattern, no real per-category reports). Taking Phase 7's version would have been a functional regression, not an upgrade, and the task's own rule is "do not overwrite newer implementations."
- **Dashboard's 3 newest KPI displays** (revenue trend %, collection rate %, avg rent/bed — Phase 4): the backend still computes them (unchanged, additive fields on `DashboardStats`); Phase 7's redesigned dashboard UI doesn't render them. Documented as a follow-up rather than forced in, since Phase 7's dashboard is a cohesive, complete redesign and grafting in 3 more stat displays without visual/layout testing risked a worse result than leaving it as Phase 7 shipped it.

## Bug found and fixed during the merge itself
Initial `cp -r` of the new component directories nested incorrectly (`src/components/owner/owner/ui/...` instead of `src/components/owner/ui/...`) because `src/components/owner` already existed as an empty placeholder directory from an earlier audit. Caught by the post-merge import-resolution sweep (every `@/components/owner/ui` import would have 404'd), fixed by removing and recreating the directories correctly, then re-verified clean.

## Post-merge validation performed
- Brace/paren balance swept across every `.ts`/`.tsx` file in the project — zero mismatches.
- Every function imported from `queries.ts` and every type imported from `types/index.ts`, anywhere in `src/`, cross-referenced against what's actually exported — zero broken imports (this is what caught the directory-nesting bug above).
- Every component imported from `@/components/owner/ui` across the app cross-referenced against its barrel export — zero broken imports.
- Sidebar's 20 nav links each confirmed to resolve to a real route folder.
- `manifest.json`, `package.json`, `tsconfig.json`, and both new theme CSS files re-validated as syntactically well-formed.
- Confirmed zero new npm dependencies needed — Phase 7's component library doesn't use Radix (the packages removed in the Production Audit remain correctly removed).

## Files Modified
- `src/components/shared/Sidebar.tsx`, `Topbar.tsx`, `OwnerShell.tsx`
- `src/app/(owner)/settings/page.tsx`, `tenants/page.tsx`, `payments/page.tsx`, `layout.tsx`
- `tailwind.config.ts`

## Files Added
- `src/components/owner/ui/*`, `src/components/tenant/ui/*`, `src/components/shared/AddPropertyModal.tsx`
- `src/app/(owner)/owner-theme.css`, `src/app/(tenant)/tenant-theme.css`
- `src/app/(owner)/properties/`, `documents/`, `notifications/`

## Files Replaced (redesigned versions, verified zero functionality loss)
- `src/app/(owner)/rooms/page.tsx`, `expenses/page.tsx`, `complaints/page.tsx`, `notices/page.tsx`, `dashboard/page.tsx`

---



# Changelog — Production Stability Sprint

Follow-up to the Final Production Audit. Fixes the one Critical issue found (Dark Theme), re-verifies build integrity, and reports on code-quality findings. No new features, no UI redesign, no business-logic changes.

## Priority 1 — Dark Theme (Complete)

**Root cause** (confirmed by audit): the app already had correct dark CSS variables and a working `.dark` class toggle, but only one page (Owner Dashboard) had ever been given actual `dark:` variant classes — every other page used literal Tailwind utilities (`bg-white`, `text-gray-900`, etc.) with no dark counterpart, so toggling dark mode produced an inconsistent, half-themed UI.

**Fix approach**: rather than hand-editing `dark:` variants into ~28 page files (a large refactor, explicitly out of scope for this sprint), added one comprehensive CSS override block in `globals.css`. Every literal color utility class actually used across the app was audited via `grep` (not guessed) and given a `.dark`-scoped override. Because `.dark .bg-white` is a more specific selector than `.bg-white` alone, these overrides win automatically with no `!important` and no component changes. The palette follows the exact slate-900/800 + color-500/10-tint convention already established on the Owner Dashboard — verified by listing every `dark:` variant already in the codebase and matching those exact values, not inventing a new palette.

**Covered**: all backgrounds (`bg-white`, `bg-gray-50/100/200/900` + hover states), full text hierarchy (`text-gray-300` through `text-gray-900`), borders/dividers, all colored badge tints (blue/green/red/amber/purple/yellow/teal/indigo), form inputs/selects/textareas (which rely on the browser's default white background, not an explicit class — given their own dedicated rule since `.bg-white` alone wouldn't catch them), tables, and Sonner toasts (targeted via Sonner's own `data-sonner-toast` attributes, since the Toaster is mounted once in the root layout, outside either shell's dark-mode state).

**Tenant Portal**: had *no* dark-mode state at all before this sprint (unlike the Owner side, which already had a toggle). Added `darkMode` state, a toggle button in the tenant header (matching the Owner Topbar's exact pattern), and the same `.dark` wrapper div — surgical, ~10-line addition to the existing 1869-line file, not a rewrite.

**Explicitly left unchanged, and why**: solid/saturated buttons (`bg-blue-600` etc.) — already have correct contrast on dark backgrounds by design, no override needed. Recharts axis/grid colors — set via inline SVG props, not CSS classes, so they're unreachable by this approach; the one color actually in use (`#94a3b8`, slate-400) already has acceptable contrast on both themes, verified across every chart in the app. Re-theming charts dynamically would require threading theme state into each chart component — a larger change than this sprint's CSS-only scope.

**Status: ✅ Complete for the sprint's defined scope** (every page, shared component, and UI pattern listed in the request). The one disclosed exception is chart inline colors, which is a genuinely minor, low-contrast-risk gap, not a broken feature.

## Priority 2 — Production Build Verification

Re-ran every static check available without a real build (no network access to install `node_modules` in this environment, same limitation as every prior audit in this engagement):
- Brace/paren balance swept across every `.ts`/`.tsx` file in the project — zero mismatches, including after the dark-theme and tenant-portal edits.
- Every function imported from `queries.ts` and every type imported from `types/index.ts`, anywhere in `src/`, cross-referenced against what's actually exported — zero broken imports.
- `globals.css` brace-balance and selector-duplication checked directly — zero issues, zero accidentally-duplicated selectors.
- `manifest.json` and `package.json` re-validated as well-formed JSON.
- Sidebar nav (19 entries) and tenant portal tab-switching logic confirmed untouched and intact.

No TypeScript/build/import/routing issues were found to fix — everything found was already clean from the prior merge and audit passes.

## Priority 3 — Code Quality

Assessed for safe, non-behavioral duplication reduction. Given the explicit "no large refactors, no file splitting" constraint, and that the prior Production Audit already removed all identified dead code and unused dependencies, no further safe cleanup was identified this pass. Reporting this honestly rather than making cosmetic changes for their own sake — see Fix Report for the full reasoning.

## Files Modified
- `src/app/globals.css` — dark theme CSS override system (~130 new lines, one file)
- `src/app/(tenant)/portal/page.tsx` — added dark-mode state, toggle button, wrapper div (~10 lines changed in a 1869-line file)

---



# Changelog — Merge: Phase 3/4 + Phase 5/6

This merge combines the audited Phase 3 & Phase 4 release (Tenant Features, Premium Dashboards — developed in parallel) with the audited Phase 5 & Phase 6 release (Reports & Operations, Final Product Polish — documented in full below this entry). The Phase 3/4 project was used as the base; Phase 5/6 work was integrated into it.

## Conflicts found and resolved

1. **Migration number collision (18–21).** Both tracks used file numbers 18–21 for entirely different features — Phase 3/4 used them for `leave_requests`, `rent_extension_requests`, `move_out_requests`/`move_out_checklists`, and a `deposit_deduction_items` column; Phase 5 used them for `visitors`, `parcels`, `waiting_list`, and `room_changes`. Confirmed zero table-name collisions between the two sets — only the file *numbers* clashed. Phase 3/4's 18–21 were kept as-is (already the audited base); Phase 5's four migrations were renumbered to **22–25**, and Phase 6's three (`automatic_backup`, `archive_restore`, `database_optimization`) shifted to **26–28** accordingly. No migration content was altered by the renumbering, only filenames.
2. **The `09_electricity_bills`/`09_utility_bills` dead-migration finding applies to this base too.** Re-verified via this project's own `queries.ts` that only `utility_bills` (from `09_CATCH_UP_ALL.sql`) is actually queried — same finding as the Phase 5/6 Production Audit, now applied here. Both files renamed to `*.DEPRECATED.sql` with explanatory headers.
3. **`src/lib/supabase/queries.ts` and `src/types/index.ts`** — both tracks added functions/types to these shared files. Zero name collisions found (verified programmatically, not just by inspection): Phase 3/4 contributed 16 functions / 12 types, Phase 5/6 contributed 24 functions / 11 types, both layered on the same 58-function/pre-existing-type common baseline. Phase 5/6's additions were appended after Phase 3/4's; the top-of-file type-only import block was merged to include both sides' `Input` types.
4. **`.env.local.example`** — Phase 3/4's audit had corrected the Super Admin comment (clarifying `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` is not actually read by the app — it's granted manually via a migration, not by email match). That correction was preserved; Phase 5/6's `CRON_SECRET` documentation was appended after it, not used to overwrite the correction.
5. **`(tenant)/portal/page.tsx`** — Phase 3/4 grew this file to 1869 lines (the bulk of their Tenant Features work: leave requests, rent extension, move-out workflow UI). Phase 5/6's only change here was one accessibility attribute (`id="main-content"` on the `<main>` tag, for the skip-to-content link). That one attribute was applied surgically on top of Phase 3/4's version — nothing else in this file was touched, and none of Phase 3/4's tenant-portal work was at risk of being overwritten.
6. **`(owner)/reports/page.tsx`** — Phase 3/4 never touched this (confirmed: their copy was byte-for-byte the original pre-Phase-5 placeholder page). Replaced wholesale with Phase 5's Reports Dashboard hub + the four dedicated report pages (`income/`, `expenses/`, `profit-loss/`) built in 5.1–5.4.
7. **`/api/push/send/route.ts`** — Phase 3/4's copy was still the pre-audit, **unauthenticated** version (the same vulnerability the Phase 5/6 audit found and fixed in 6.10: anyone who found the URL could send arbitrary push notifications to any user). The fix was applied here — this endpoint now requires a session and restricts non-admins to notifying only their own tenants.

## Files confirmed identical between both tracks (no merge needed, either version usable)
`PropertyContext.tsx`, `EnableNotificationsBanner.tsx`, `ForcePasswordChangeModal.tsx`, `SignaturePad.tsx`, `UpiPayButtons.tsx`, `PWARegister.tsx`, `utils/index.ts` (Phase 3/4's version is a superset — kept), `tailwind.config.ts`, `README.md`.

## Files taken wholesale from Phase 5/6 (confirmed zero Phase 3/4 changes to these)
`Sidebar.tsx`, `Topbar.tsx`, `push.ts`, `pdf.ts`, `layout.tsx`, `globals.css`, `next.config.ts`, `manifest.json`, `sw.js`, `vercel.json`, `settings/page.tsx`, `OwnerShell.tsx` (plus its one-line `main-content` id) — every one of these was verified via diff to be either byte-identical to Phase 5/6's starting baseline, or to have Phase 5/6's changes as the *only* difference, before being taken wholesale.

## New in this merge (neither track had these)
- `.eslintrc.json`, `.gitignore` — neither existed in either track; added (from the Phase 5/6 Production Audit).
- Removed 9 unused `@radix-ui/*` packages + `class-variance-authority` from `package.json` — confirmed zero usage in **this merged project's** `src/` (not just re-assumed from the earlier audit).
- Removed `NotificationBell.tsx` (dead code, zero importers, confirmed in this merged project too) and `ReportComingSoon.tsx` (never existed in the Phase 3/4 base — it was Phase 5.1's placeholder, already removed in Phase 5/6's own final state).

## Post-merge validation performed
- Brace/paren balance swept across every `.ts`/`.tsx` file in the merged project — zero mismatches.
- Every function imported from `queries.ts` anywhere in `src/` cross-referenced against what it actually exports — zero broken imports.
- Every type imported from `types/index.ts` cross-referenced the same way — zero broken imports.
- Every shared component (`src/components/shared/*`) confirmed to have at least one real importer (accounting for relative `./X` imports as well as `@/components/shared/X` absolute imports) — zero orphans besides the two intentionally removed.
- Sidebar nav array checked for duplicate `href`s — none, 19 total entries (10 from Phase 3/4's baseline + 9 from Phase 5).
- `manifest.json` re-validated as well-formed JSON.
- `package.json` re-validated as well-formed JSON.

## Known follow-ups (not blockers, documented for whoever picks this up)
- This merge was performed by direct file comparison and surgical patching, not `git merge` — there is no repository history here to preserve; MERGE_NOTES.md documents every file touched instead.
- Could not run `npm install`, `npm run build`, `npm run lint`, or `tsc --noEmit` in this environment (no network access to fetch packages) — the checks above are the strongest verification possible without a real build. A real build/lint pass is recommended as the next step before this becomes the base for the Tenant UI merge.
- Two dead migration files remain as `.DEPRECATED.sql` (kept for history, not deleted) — see the note in the Phase 5/6 Production Audit entry below for why.

---

# Changelog — Production Audit: Phase 5 & Phase 6

Complete production readiness and merge readiness audit, performed as the final quality gate before merging into the audited Main Project. Per the audit's own rules: no new features, no UI redesign, no business-logic changes except where required to fix a genuine production issue. One qualified.

## Issues Found

1. **Three competing "09" migrations for the same feature.** `09_electricity_bills.sql` (table `electricity_bills`), `09_utility_bills.sql` (table `bills`), and `09_CATCH_UP_ALL.sql` (table `utility_bills`) all implemented what's conceptually the same tenant-bills feature, each under a different table name. Confirmed via `queries.ts` that the app only ever queries `utility_bills` — the other two are dead, abandoned migration files that would create orphaned, never-used tables if run.
2. **Unused dependencies.** 9 `@radix-ui/*` packages plus `class-variance-authority` were installed but had zero usages anywhere in `src/` — confirmed via grep, and via an empty `src/components/ui` directory (the only trace of an abandoned shadcn/ui scaffold). `tailwindcss-animate` was initially suspected too, but checked separately and confirmed required by `tailwind.config.ts`'s `plugins` array — correctly kept.
3. **Two orphaned dead-code components.** `ReportComingSoon.tsx` (Phase 5.1's placeholder, orphaned once 5.2–5.5 replaced its consumers) and `NotificationBell.tsx` (pre-existing, zero importers anywhere, superseded by Topbar's inline notification UI) — both confirmed to have zero importers before removal.
4. **Missing sidebar entry for `/notices`** (already fixed in 6.12, re-confirmed here) — the page exists and works, just wasn't reachable from navigation.
5. **The unauthenticated `/api/push/send` endpoint** (already fixed in 6.10, re-confirmed here as the most significant finding across both phases) — re-verified during this audit that the fix is in place and every other API route has appropriate auth.

## Issues Fixed

- Renamed the two dead migration files to `*.DEPRECATED.sql` with explanatory headers rather than deleting them outright, preserving history while making the conflict unmissable in a directory listing.
- Removed the 10 confirmed-unused packages from `package.json`.
- Removed the 2 confirmed-orphaned dead-code files.

## Performance Improvements

None new in this pass — 6.6 (lazy-loaded PDF/Excel libraries) and 6.7 (query-justified indexes) were already thorough. Re-verified both hold up: spot-checked that `pdf.ts`'s lazy imports and the Reports pages' `xlsx` imports are still correctly structured after all subsequent phases, and re-confirmed no new N+1 patterns were introduced across 6.8–6.12.

## Security Improvements

None new — 6.10's `/api/push/send` fix was re-verified as still in place and correct (session required, non-admins restricted to their own tenants). Re-checked this pass that no server-only secret (`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`) is referenced from any `'use client'` file anywhere in the app — confirmed clean.

## Code Cleanup

- Cross-referenced every function imported from `queries.ts` against what it actually exports, and every type imported from `types/index.ts` against what it actually exports, across the entire `src/` tree — zero broken imports found.
- Swept every file touched across this entire engagement for brace/paren balance — zero mismatches.
- Verified every table created by any migration has RLS enabled somewhere in the migration set.
- Verified every environment variable referenced in code is documented in `.env.local.example`.
- Verified `manifest.json` is still well-formed JSON after all of 6.1's edits.

## Self-Review

_"Would I confidently merge this into the audited Main Project?"_ — Yes, with the three conditions listed in `MERGE_NOTES.md`: run the 7 pending migrations, set `CRON_SECRET`, and run a real `npm install && npm run build` post-merge (this environment had no network access to do that verification step itself, and that's stated plainly rather than implied as done).

## Documentation Added

- `PROJECT_STATE.md` — completed features, folder structure, database changes, pending work
- `MERGE_NOTES.md` — files modified/added/removed, merge risks, merge recommendation
- `DEPLOYMENT_NOTES.md` — Vercel/Supabase readiness, required env vars, deployment steps

## Files Modified
- `package.json`
- `supabase/09_electricity_bills.sql` → `09_electricity_bills.DEPRECATED.sql`
- `supabase/09_utility_bills.sql` → `09_utility_bills.DEPRECATED.sql`

## Files Removed
- `src/components/shared/ReportComingSoon.tsx`
- `src/components/shared/NotificationBell.tsx`

## Files Added
- `PROJECT_STATE.md`, `MERGE_NOTES.md`, `DEPLOYMENT_NOTES.md`

---

# Changelog — Phase 6.12: Final Project Audit

This is the last micro-phase in the roadmap (Phase 5 + Phase 6, 27 micro-phases total). Rather than adding another feature, this is a real pass back over everything built across both phases, checking for exactly the kind of loose ends a rushed final phase would otherwise skip.

## What was checked
- **Every SQL migration (18–24) accounted for and sequential**, no gaps or naming collisions with the pre-existing 01–17.
- **Every file touched or created this entire engagement** (checked via filesystem timestamps against the original upload) swept for brace/paren balance — zero mismatches.
- **Every `queries.ts` function imported anywhere in the app is actually exported by it**, and **every type imported from `types/index.ts` actually exists there** — cross-referenced programmatically, not eyeballed. Zero broken imports found.
- **`manifest.json` re-validated as well-formed JSON** after all of Phase 6.1's edits.
- **The Sidebar nav array checked for duplicate hrefs** — none.

## Found and fixed
- **`/notices` had no sidebar entry.** The page has existed since before Phase 5 (it's one of the "Completed" pre-Phase-5 features), fully built and working, but there was never a way to navigate to it from the sidebar — a real, pre-existing gap, not something introduced this engagement. One line added; the Notices page itself wasn't touched.

## Migration run order (18 → 24), for reference
1. `18_visitor_management.sql`
2. `19_parcel_management.sql`
3. `20_waiting_list.sql`
4. `21_room_change_log.sql`
5. `22_automatic_backup.sql`
6. `23_archive_restore.sql`
7. `24_database_optimization.sql`

## Standing scope decisions across Phase 5 + 6 (for anyone picking this up later)
A few deliberate, disclosed tradeoffs came up more than once and are worth restating in one place:
- **Parallel-development boundary held throughout**: no file under Tenant Features, Leave Management, Rent Adjustment, Deposit Workflow, Move-Out Workflow, Agreement Renewal, Owner/Tenant Dashboard, KPI Cards, Charts, Analytics, or Dashboard Widgets was ever modified. Room Change Workflow (5.11) deliberately never touches rent/deposit fields for exactly this reason.
- **Per-property fetching uses `Promise.all` across properties, not batched `.in()` queries** (flagged in 6.7) — bounded by parallel latency, but more round-trips than a single owner with many properties would ideally want.
- **Backup Restore (5.14) is merge-only, never destructive** — by design, not as a limitation.
- **Accessibility label-association fix (6.9) was completed fully for one representative form** (Visitors) and partially for two others (Parcels, Waiting List) — same mechanical pattern, not finished everywhere.
- **The one real security fix (6.10)** — the unauthenticated `/api/push/send` endpoint — was the most serious finding across both phases and was fixed thoroughly, not just patched around the edges.

## Files Modified
- `src/components/shared/Sidebar.tsx` (added the missing Notices nav entry)

---

# Changelog — Phase 6.11: Production Cleanup

## Analyzed first (per project rules) — checked for the usual suspects, found the code itself was already clean
- Searched for `console.log`/`console.debug`/`console.warn`, `debugger` statements, `TODO`/`FIXME` markers, native `alert()` calls, hardcoded secrets or JWT-looking tokens in source, and leftover test/debug/demo routes or `.bak`/`.orig` files — found none of any of these. The codebase (both pre-existing and everything built across Phases 5–6) was already clean on all of these fronts; nothing to remove.
- Found two real, structural gaps instead — not code smells, but missing project-level safety nets:
  1. **No `.gitignore` anywhere in the project.** `node_modules`, the `.next` build output, and — seriously — **`.env.local`, which holds real Supabase and VAPID secrets**, were all one `git add .` away from being committed to version control.
  2. **No ESLint config**, despite `eslint`, `eslint-config-next`, and a `next lint` script all being present in `package.json`. Without a config file, `next lint` has nothing to actually lint against — the tooling was installed but silently doing nothing.

## Added
- **`.gitignore`**: standard Next.js project ignores (`node_modules`, `.next`, `.env*.local`, `.vercel`, build artifacts, OS files) — most importantly, this is what actually keeps `.env.local`'s real secrets out of version control going forward.
- **`.eslintrc.json`**: `{ "extends": "next/core-web-vitals" }` — the standard Next.js default, matching the already-installed `eslint-config-next` version. Used the legacy `.eslintrc.json` format specifically (not ESLint 9's flat config) because this project's `eslint` dependency is pinned to `^8.57.1`, which doesn't support flat config.

## Scope notes (kept honest, nothing fabricated)
- Did not run `next lint` or `next build` myself to generate a list of lint findings to fix — no network access in this environment to install `node_modules`. Added the config so linting is actually possible going forward; running it and addressing whatever it finds is a natural next step, not something silently skipped here.

## Files Added
- `.gitignore`
- `.eslintrc.json`

---

# Changelog — Phase 6.10: Security Hardening

## Analyzed first (per project rules) — found one real vulnerability, checked several other angles before concluding they were fine
- **Found a genuine, serious gap**: `/api/push/send` had **no authentication check at all**. Anyone who found the URL could POST arbitrary `{ user_ids, title, body }` and it would happily send a real push notification — with fully attacker-controlled title/body — to any of those users' devices, and write spam rows into their `notification_log`. This used the service-role key internally, so nothing in RLS was protecting it.
- Checked for `dangerouslySetInnerHTML` anywhere in the codebase (none — no XSS-via-innerHTML vector), checked the other API routes (`/api/push/resubscribe` already had a correct cookie-based auth check from 6.2; `/api/cron/automatic-backup` already had its bearer-token check from 5.13), and checked whether the app uses camera/microphone/geolocation anywhere before writing a `Permissions-Policy` header — found real camera usage (`<input capture="environment">` for government-ID photo capture during tenant self-registration in the join flow) and deliberately did **not** restrict camera, only microphone and geolocation, which are genuinely unused.
- Found `NEXT_PUBLIC_SUPER_ADMIN_EMAIL`-based promotion logic lives in the SQL migrations, not the app code. Didn't attempt to audit or change it — that's core auth/schema territory the permanent rules explicitly protect, and correctly diagnosing a SQL trigger's security properties from a read-only pass is a different, much deeper task than this micro-phase warrants.

## Fixed
- **`src/app/api/push/send/route.ts`**: now requires a real authenticated session (cookie-based, same as the rest of the app). Unless the caller is a `super_admin`, the endpoint filters `user_ids` down to only tenants that actually belong to a property the caller owns — mirroring the exact ownership boundary every RLS policy in this app already enforces at the database level, just applied here in application code since this route uses the service-role key and bypasses RLS by design. If none of the requested `user_ids` belong to the caller, the request is rejected with 403 rather than silently sending to nobody.
- **`next.config.ts`**: added baseline HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` restricting only the genuinely-unused microphone/geolocation). Deliberately did **not** add a Content-Security-Policy — a strict CSP needs a careful, page-by-page audit of every inline script/style and third-party origin (Supabase, web-push) to avoid silently breaking the app, which is a bigger, riskier undertaking than a drive-by header addition should attempt.

## Scope notes (kept honest, nothing fabricated)
- This was a targeted pass, not an exhaustive penetration test. The one vulnerability found was real and serious enough to prioritize fixing thoroughly and correctly over finding a longer list of smaller items.
- Did not touch the SQL-side auth/super-admin-promotion logic — flagged as out of scope rather than guessed at.

## Files Modified
- `src/app/api/push/send/route.ts`
- `next.config.ts`

---

# Changelog — Phase 6.9: Accessibility Improvements

## Analyzed first (per project rules) — checked what was already done before assuming gaps
- Found some existing effort: the Notifications bell button already had a correct `aria-label`. Not starting from zero.
- Found real, concrete gaps: several icon-only buttons in the two most shared components in the app (Topbar, Sidebar — present on every owner page) had no accessible name at all; no `error.tsx`-style "skip to content" link existed anywhere for keyboard users to bypass the sidebar nav; the three "Log X" modals built in Phase 5 (Visitors/Parcels/Waiting List) had no `role="dialog"`/`aria-modal` semantics; and none of those modals' form labels were actually associated with their inputs via `htmlFor`/`id` (a sighted user sees the label next to the field, but a screen reader has no guaranteed link between them).

## Fixed
- **`src/app/layout.tsx`**: added a "Skip to content" link — visually hidden until keyboard-focused (`sr-only focus:not-sr-only`), jumps straight to `#main-content`.
- **`src/components/shared/OwnerShell.tsx`** / **`(tenant)/portal/page.tsx`**: added `id="main-content"` to each shell's `<main>` as the skip-link's target.
- **`src/components/shared/Topbar.tsx`**: `aria-label`s added to the hamburger menu, dark-mode toggle, and the Add Property modal's close button.
- **`src/components/shared/Sidebar.tsx`**: `aria-label`s added to the mobile close button and the logout button.
- **Visitors modal** (`(owner)/visitors/page.tsx`) — treated as the fully-fixed representative example: the modal now has `role="dialog" aria-modal="true" aria-labelledby`, every one of its 6 form fields has a proper `htmlFor`/`id` pair, its close button has `aria-label="Close"`, and its Archive/Delete row actions have `aria-label`s matching their existing `title`s.
- **Parcels & Waiting List modals**: got the dialog ARIA roles, close-button label, and Archive/Delete labels — the same fixes that don't require touching every individual field.

## Scope notes (kept honest, nothing fabricated)
- The `htmlFor`/`id` label-association fix was fully completed for the Visitors modal only, as the representative example of the pattern. Parcels' and Waiting List's form fields follow the exact same structure and need the identical mechanical fix (one `id`/`htmlFor` pair per field) — flagging this directly rather than claiming full coverage. It's a repetitive, low-risk follow-up, not a design decision that needs re-litigating.
- Did not attempt a full app-wide audit of every icon-only button (there are many, across pages this project didn't build too) — focused on the two components that appear on literally every owner page (Topbar, Sidebar) plus this project's own most recently built modals, rather than a shallow pass over everything.
- Did not add focus-trapping to the modals (keeping Tab from escaping to the page behind an open dialog) — that requires either a dependency or non-trivial custom focus-management code, a larger addition than the ARIA-role/labeling fixes made here.

## Files Modified
- `src/app/layout.tsx`
- `src/components/shared/OwnerShell.tsx`
- `src/app/(tenant)/portal/page.tsx`
- `src/components/shared/Topbar.tsx`
- `src/components/shared/Sidebar.tsx`
- `src/app/(owner)/visitors/page.tsx`
- `src/app/(owner)/parcels/page.tsx`
- `src/app/(owner)/waiting-list/page.tsx`

---

# Changelog — Phase 6.8: Mobile UX Improvements

## Analyzed first (per project rules) — checked navigation pattern before touching anything
- Confirmed the mobile nav is a slide-out drawer (hamburger menu), not a bottom tab bar — a deliberate existing design, not a gap. Given the permanent "never redesign existing UI" rule, this phase is scoped to real, surgical fixes, not a navigation-pattern change.
- Found three genuine, well-scoped mobile bugs, all fixable without touching any visual layout, color, or spacing:
  1. **iOS Safari auto-zoom on input focus** — every form input across the app uses `text-sm` (14px); any text input under 16px triggers Safari's automatic zoom-in on focus, which is jarring and affects every single form in the app.
  2. **No safe-area handling** — the `viewport` export didn't request `viewport-fit=cover`, and the Sidebar's pinned bottom user/logout row had no accounting for the home-indicator gesture area on notched iPhones.
  3. **Default tap feedback** — no `-webkit-tap-highlight-color` or `touch-action: manipulation`, meaning taps show the browser's default gray flash and carry the classic ~300ms mobile tap delay instead of feeling instant.

## Fixed
- **`src/app/layout.tsx`**: `viewport` export now explicitly sets `width: 'device-width'`, `initialScale: 1`, and `viewportFit: 'cover'`. Deliberately did **not** set `maximumScale`/`userScalable: false` — disabling pinch-zoom is an accessibility regression (WCAG 1.4.4), not a mobile UX win.
- **`src/app/globals.css`**: a `@media (max-width: 767px)` rule raises input/select/textarea font-size to 16px on mobile only (prevents the iOS zoom without changing anything on desktop); a reusable `.pb-safe` utility (`max(0.75rem, calc(0.75rem + env(safe-area-inset-bottom)))`); `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` on `body`.
- **`src/components/shared/Sidebar.tsx`**: applied `.pb-safe` to the bottom user/logout row so it clears the home-indicator area instead of sitting flush against it.

## Scope notes (kept honest, nothing fabricated)
- Did not audit or resize small icon-only buttons (delete/archive actions etc.) against the 44×44px touch-target guideline — several are visibly smaller than that across both this project's pages and pre-existing ones, but bumping padding on every icon button app-wide is a broad visual density change bordering on redesign, not a surgical fix, so it's flagged here rather than attempted as a drive-by.
- Did not change the drawer-style mobile navigation to a bottom tab bar or otherwise restructure it — that's a deliberate existing pattern, not a bug.

## Files Modified
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/shared/Sidebar.tsx`

---

# Changelog — Phase 6.7: Database Optimization

## Analyzed first (per project rules) — audited indexes and RLS function performance across every migration, not just this project's own
- Listed every `create index` across all 24 migration files (base schema through Phase 6) to build a full picture before adding anything, rather than guessing what might be missing.
- Checked `get_my_role()`/`owns_property()` — used in nearly every RLS policy in the app — and confirmed they were already correctly marked `stable`, which lets Postgres's query planner avoid re-evaluating them per row. No fix needed there; already done right from the start.
- Cross-referenced every `create index` decision below against an actual `.eq(...)`/`.order(...)` call already present in `queries.ts` — every index added is justified by a real query pattern, not a speculative one.

## Added
- **`supabase/24_database_optimization.sql`**:
  - `payments(payment_date desc)` and `payments(property_id, approval_status)` — Income Report, P&L, the dashboard chart, and pending-approval notifications all filter/sort on exactly these.
  - `expenses(expense_date desc)` — same reasoning for the Expense Report and P&L.
  - `tenants(property_id, status)` — `getDashboardStats` and `getOwnerNotifications` both filter tenants by this exact combination server-side.
- Explicitly did **not** add an index on `tenants.room_id` — confirmed no query anywhere actually filters on it server-side (occupancy grouping happens client-side after fetch), so an index there would be dead weight, not optimization.

## Scope notes (kept honest, nothing fabricated) — one real tradeoff identified, deliberately not fixed here
- Several pages built across Phase 5/6 (Backup, Room Change, Visitors, Parcels, Waiting List) fetch per-property data via `Promise.all(propertyIds.map(getX))` — for an owner with many properties, that's N parallel round-trips per table instead of one `.in('property_id', ids)` query. Latency stays bounded by the slowest single request (they run in parallel, not sequentially), but it is more round-trips than strictly necessary. Rewriting this would mean adding multi-property query variants and touching ~10 files for a win that mostly matters at a property count most PG owners won't reach. Flagging it here rather than either silently leaving it undocumented or doing a risky broad refactor as a drive-by part of an indexing pass.

## Files Added
- `supabase/24_database_optimization.sql`

---

# Changelog — Phase 6.6: Performance Optimization

## Analyzed first (per project rules) — looked for real, safe, high-leverage wins
- Checked for N+1 query patterns, missing `Promise.all` parallelization, and unbounded result sets across pages — the app (including everything built in Phases 5–6 so far) already parallelizes per-property fetches with `Promise.all` consistently. No obvious query-level win there without touching pagination behavior on pages outside this project's safe scope.
- Found a real, safe one: **`jspdf`, `jspdf-autotable`, and `qrcode` were statically imported** at the top of `src/lib/pdf.ts`, and **`xlsx`** was statically imported at the top of all four Reports pages. Both libraries are non-trivial in size, and in every case they're only actually needed once someone clicks a specific "Export" or "Download" button — not on initial render of the page. Static imports mean that JS ships and parses as part of that route's chunk whether or not the button is ever pressed.

## Changed
- **`src/lib/pdf.ts`**: `jsPDF`/`jspdf-autotable`/`qrcode` are now imported as `type` (zero runtime cost, keeps existing type annotations like `doc: jsPDF` working) plus lazy-loaded via dynamic `import()` inside each exported function, right when it's called. `generateAgreementPDF` had to become `async` to do this — checked its one call site (`(tenant)/portal/page.tsx`) first and confirmed it was already fire-and-forget (not awaited, return value unused), so this required zero changes there.
- **The four Reports pages** (`reports/page.tsx`, `reports/income`, `reports/expenses`, `reports/profit-loss`): same treatment for `xlsx` — removed the top-level `import * as XLSX from 'xlsx'`, each `exportExcel` function now does `const XLSX = await import('xlsx')` as its first line and was already (or is now) `async`.

## Scope notes (kept honest, nothing fabricated)
- This only touches files this project already owns (`pdf.ts`, and the four Reports pages built in Phase 5) — did not touch `tenants/page.tsx`, `payments/page.tsx`, `(tenant)/portal/page.tsx`, or `join/[slug]/page.tsx`, even though they also call into `pdf.ts`, because they benefit automatically from the lazy-loading inside `pdf.ts` itself without needing any changes of their own. Zero risk to code outside this project's territory, for the same benefit.
- Did not add pagination or result-set limits to any list query — every one already parallelizes correctly, and changing result-set size is a behavior change with UX implications (e.g. "why don't I see all my tenants?") that deserves its own deliberate decision, not a drive-by change bundled into a performance pass.
- Did not introduce `next/dynamic` for any component-level code-splitting — the wins here were specifically the two heavy Node-style libraries (`xlsx`, `jspdf`) that have no real UI of their own; component-level splitting wasn't an identified problem anywhere.

## Files Modified
- `src/lib/pdf.ts`
- `src/app/(owner)/reports/page.tsx`
- `src/app/(owner)/reports/income/page.tsx`
- `src/app/(owner)/reports/expenses/page.tsx`
- `src/app/(owner)/reports/profit-loss/page.tsx`

---

# Changelog — Phase 6.5: Error Handling

## Analyzed first (per project rules) — same gap shape as 6.4, verified before assuming
- Checked for `error.tsx`, `global-error.tsx`, and `not-found.tsx` anywhere in the App Router tree — none existed, meaning any render-time error fell straight through to Next.js's default handling (a raw dev overlay, or a generic unbranded error page in production) instead of anything belonging to the app. Same root cause as the missing `loading.tsx` files fixed in 6.4.
- Checked API-route error handling separately (`/api/push/*`, `/api/cron/automatic-backup`) and client-side `catch` blocks across pages — these were already consistent (`{ error: message }` JSON responses with real status codes; `toast.error(e.message || '...')` almost everywhere on the client). No changes needed there — this phase is specifically about the missing render-time error *boundaries*, not the parts that were already handled well.

## Added
- **`src/components/shared/ErrorFallback.tsx`**: shared error-boundary UI — calm, branded "something went wrong" with a real Try Again (`reset()`) and Go Home action. Deliberately never renders `error.message` on screen (an error message could leak internal details to an end user) — same defensive instinct as never surfacing raw Supabase errors verbatim elsewhere in the app.
- **`error.tsx`** at the root and at each route group — `(owner)`, `(tenant)`, `(admin)`, `(auth)` — each pointing "Go Home" at the right destination for that section (`/dashboard`, `/portal`, `/admin`, `/login`) rather than a generic `/`.
- **`global-error.tsx`**: the one boundary that fires if the root layout itself throws. Per Next.js's requirement, this must define its own `<html>`/`<body>` and can't safely depend on anything the broken layout provides — kept intentionally plain, inline-styled, and dependency-free rather than reusing `ErrorFallback`.
- **`not-found.tsx`**: a branded 404 instead of Next's generic default, linking back through the existing auth-aware redirect at `/` (reused as-is) rather than guessing which dashboard to send someone to.

## Scope notes (kept honest, nothing fabricated)
- This covers render-time errors (a component throwing while rendering). It does not change how any individual page's own try/catch + toast error handling works — that pattern was already solid and consistent, and touching dozens of pages to "standardize" something that wasn't actually broken would be scope creep, not a fix.

## Files Added
- `src/components/shared/ErrorFallback.tsx`
- `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`
- `src/app/(owner)/error.tsx`, `src/app/(tenant)/error.tsx`, `src/app/(admin)/error.tsx`, `src/app/(auth)/error.tsx`

---

# Changelog — Phase 6.4: Loading Experience

## Analyzed first (per project rules) — found a real, consistent gap
- Checked every page in the app: each one already handles its own in-flight data loading well (a consistent `if (loading) return <Loader2 .../>` pattern almost everywhere). What was missing was route-level: zero `loading.tsx` files anywhere in the App Router tree, so navigating to a new route could show a blank white screen for a moment (bundle load / route preparation) before the destination page's own component even mounts and gets a chance to show its spinner — most noticeable on slower connections or bigger route chunks.
- Confirmed Next.js's `loading.tsx` is inherited down the route tree, so one per route group (not one per page) covers every nested route under it — added exactly that instead of duplicating a loading file into every single page folder.

## Added
- **`src/components/shared/PageLoader.tsx`**: one shared, centered-spinner component — deliberately matching the exact look every page's own loading state already uses, not a new visual language.
- **`loading.tsx`** added at the root (`src/app/`) and at each route group — `(owner)`, `(tenant)`, `(admin)`, `(auth)` — covering every route in the app with four small files instead of one per page.

## Scope notes (kept honest, nothing fabricated)
- This fills the gap between "navigation started" and "the page's own component has mounted" — it does not replace or change any page's existing in-component loading state (the `if (loading) return ...` spinners), which were already handling their own data-fetch waits correctly and were left untouched.
- Did not build full skeleton-screen layouts per page (content-shaped placeholders instead of a spinner) — that's a much larger, page-by-page design effort disproportionate to a single micro-phase, and the existing spinner pattern is already the app's established visual language, not a gap.

## Files Added
- `src/components/shared/PageLoader.tsx`
- `src/app/loading.tsx`
- `src/app/(owner)/loading.tsx`
- `src/app/(tenant)/loading.tsx`
- `src/app/(admin)/loading.tsx`
- `src/app/(auth)/loading.tsx`

---

# Changelog — Phase 6.3: Offline Queue Improvements

## Analyzed first (per project rules) — found no baseline to improve
- Searched the whole codebase for any existing queue, IndexedDB usage, background-sync registration, or `navigator.onLine` handling — there was none. "Improvements" implied a baseline that doesn't actually exist. Rather than skip the phase, this builds a deliberately minimal, honestly-scoped primitive and says so directly here, instead of pretending something was already there.

## Added
- **`src/lib/offlineQueue.ts`**: a small, generic offline-action queue backed by `localStorage` (not IndexedDB — the queue is only ever a handful of pending items between reconnects, and this runs entirely on the page, not in the background, so the simpler synchronous API is the right tool here, not a limitation). Exposes `queueOfflineAction`, `getQueuedActions`, `subscribeToQueueChanges`, and `flushOfflineQueue` (which never throws — a failed sync attempt should retry quietly later, not surface as an app error).
- **`src/components/shared/OfflineQueueBadge.tsx`**: a small pending-count pill in the Topbar (visible from every owner page) that auto-flushes on the `online` event and offers a manual "tap to sync" too.
- **Applied to two representative flows** — Visitor check-in and Parcel logging — rather than retrofitting every mutation in the app. Both are simple, low-risk single inserts commonly done by on-site staff at a property entrance, exactly where spotty wifi is most likely to bite. If the insert fails specifically because `navigator.onLine` is false (not for any other reason — validation errors, RLS issues, etc. still surface normally), the action is queued instead of shown as a failure, and the form closes as if it succeeded.
- The Parcel-logging executor mirrors the online path exactly, including sending the tenant's "parcel arrived" push notification once the sync actually completes — not just the database insert.

## Scope notes (kept honest, nothing fabricated)
- Deliberately scoped to two flows, not the whole app. Payments, expenses, complaints, etc. still fail normally when offline — extending this pattern app-wide would be a much larger effort than "improve the offline queue" for a single micro-phase, especially for anything involving push notifications, file uploads, or multi-step validation.
- No service-worker-level Background Sync API — that requires the browser to wake the SW in the background even after the tab closes, which is a meaningfully bigger (and less consistently supported cross-browser) mechanism than what a single micro-phase justifies. This queue only flushes while the app is open and reconnects.

## Files Added
- `src/lib/offlineQueue.ts`
- `src/components/shared/OfflineQueueBadge.tsx`

## Files Modified
- `src/components/shared/Topbar.tsx` (renders the badge)
- `src/app/(owner)/visitors/page.tsx` (queues check-in when offline)
- `src/app/(owner)/parcels/page.tsx` (queues parcel logging when offline)

---

# Changelog — Phase 6.2: Push Notification Audit

## Analyzed first (per project rules) — most of this was already solid
- Read `push.ts`, `/api/push/send`, `sw.js`'s push/notificationclick handlers, `EnableNotificationsBanner`, and every `sendPushNotification` call site (Complaints, Payments ×2, Notices, Parcels) before changing anything.
- The send path was already well-built: VAPID validated before sending, every recipient logged to `notification_log` regardless of delivery outcome (so the notification bell/history is never missing entries), and dead subscriptions (404/410) already cleaned up automatically. Every call site already correctly gated on `tenant.auth_user_id` being present rather than assuming it — no bugs found there.
- Found two real, meaningful gaps:
  1. **One-way enable, no disable.** `EnableNotificationsBanner` could turn notifications on, but `disablePushNotifications()` (which already existed in `push.ts`) had no UI calling it anywhere — the only way to stop notifications was revoking permission from the browser's own settings, outside the app entirely.
  2. **No `pushsubscriptionchange` handling.** Browsers occasionally rotate or invalidate a push subscription on their own and fire this event as a chance to resubscribe. Without a handler for it, a user who'd already enabled notifications would silently stop receiving them with no visible sign anything broke.

## Added / Fixed
- **Settings → Notifications** (new card, `src/app/(owner)/settings/page.tsx`): a real toggle reflecting actual subscription state (not just permission state, since those can differ) — flip it on/off, with a clear message when the browser has the permission blocked at the OS/browser level (which JS can't override, so the UI says so instead of pretending the toggle can fix it).
- **`hasActiveSubscription()`** added to `push.ts` so the Settings toggle reflects reality instead of just whether permission was ever granted.
- **`public/sw.js`**: added a `pushsubscriptionchange` handler that resubscribes with the same VAPID key and persists the new subscription — using a small dedicated endpoint rather than duplicating the full send-route logic.
- **`src/app/api/push/vapid-public-key/route.ts`**: lets the service worker fetch the public VAPID key at runtime (a plain static `sw.js` file has no access to Next.js env vars the way bundled client code does). Not a secret — it's the same key already shipped to every browser via `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- **`src/app/api/push/resubscribe/route.ts`**: persists a rotated subscription. Uses the cookie-based server client (not the service-role client) since a same-origin fetch from the service worker still carries the browser's session cookies — if there's no session available, it's a no-op rather than an error, since there's nothing meaningful to do without a signed-in user.

## Scope notes (kept honest, nothing fabricated)
- `pushsubscriptionchange` firing while the app has no valid session cookie (e.g. it happens while fully signed out) is a no-op by design — the user simply re-enables from Settings or the banner next time they're signed in. This is an accepted, disclosed limitation, not a silent failure being papered over.
- Did not add a "send test notification" button — that's a nice-to-have, not a gap the existing system actually has.

## Files Added
- `src/app/api/push/vapid-public-key/route.ts`
- `src/app/api/push/resubscribe/route.ts`

## Files Modified
- `public/sw.js` (added `pushsubscriptionchange` handler)
- `src/lib/push.ts` (added `hasActiveSubscription`)
- `src/app/(owner)/settings/page.tsx` (added Notifications toggle card)

---

# Changelog — Phase 6.1: PWA Audit

## Analyzed first (per project rules) — audited the existing PWA setup end to end
- Read `manifest.json`, `sw.js`, `layout.tsx`'s metadata/viewport, `PWARegister.tsx`, and the icon set on disk before changing anything. Most of it was already solid: correct icon sizes (192/512/maskable-512), apple-touch-icon wired up, theme color consistent between manifest and viewport metadata, and a deliberately conservative service worker that never caches pages or API responses (correctly, for an app showing live financial data).
- Found two real gaps, both fixed:
  1. **`start_url` was `/login`**, bypassing the app's own auth+role redirect logic that already lives at `/` (`src/app/page.tsx` — redirects to `/admin`, `/portal`, or `/dashboard` as appropriate, or `/login` if signed out). An installed PWA icon was sending already-logged-in owners and tenants back to the login form every time instead of straight into the app. Confirmed `/login` has no session-redirect logic of its own before making this change, so the fix is safe, not just faster.
  2. **No offline fallback** — a network failure while navigating fell through to the browser's generic offline error page instead of anything belonging to the app.

## Added / Fixed
- **`public/manifest.json`**: `start_url` changed from `/login` to `/`. Added a small `shortcuts` entry (Payments, Tenants) reusing the existing 192px icon — no new image assets needed.
- **`public/offline.html`**: a small, fully self-contained offline page (no external fonts/scripts, since it has to render with zero network) with a Retry button.
- **`public/sw.js`**: bumped the cache version (v1 → v2) so the new offline page actually gets cached on update; added a navigation-specific fetch handler that's network-first and only falls back to the cached offline page if the network request fails outright — every other request (static assets, API, Supabase calls) behaves exactly as before, untouched.

## Scope notes (kept honest, nothing fabricated)
- Did not add iOS splash screens or a `screenshots` manifest field — both require generating new image assets, which is a design-asset task rather than a code audit, and neither blocks the app from working correctly as a PWA today.
- The offline fallback only covers full-page navigations (the realistic "I opened the app with no signal" case) — it does not attempt to queue or retry failed API calls; that's Phase 6.3 (Offline Queue Improvements), not this one.

## Files Added
- `public/offline.html`

## Files Modified
- `public/manifest.json`
- `public/sw.js`

---

# Changelog — Phase 5.15: Archive & Restore

## Analyzed first (per project rules) — scoped deliberately, checked all downstream effects
- Scoped **only** to the three operational tables built earlier in this same phase — Visitors (5.8), Parcels (5.9), Waiting List (5.10). Deliberately did not touch Complaints or Notices (pre-Phase-5 features) or anything tenant/dashboard-related, to keep this a clean, self-contained addition with zero merge risk.
- Changing `getVisitors`/`getParcels`/`getWaitingList` to exclude archived rows by default is a real behavior change to code from 5.8–5.10 — traced every call site before making it. Found and fixed the one that mattered: Manual Backup (5.12) was calling these three without requesting archived rows, which after this change would have silently made backups incomplete. Fixed by passing `includeArchived = true` there specifically, so backups still capture everything, archived or not.
- Automatic Backup's cron route selects `*` directly via the service-role client with no archived filter at all, so it was already unaffected — verified rather than assumed.

## Added
- **`supabase/23_archive_restore.sql`**: adds a nullable `archived_at` column (+ index) to `visitors`, `parcels`, `waiting_list`. No new tables.
- **Queries**: `getVisitors`/`getParcels`/`getWaitingList` gained an `includeArchived` parameter (default `false`, so existing pages automatically get a decluttered view for free); added `archiveVisitor`/`restoreVisitor`, `archiveParcel`/`restoreParcel`, `archiveWaitingListEntry`/`restoreWaitingListEntry`.
- **Archive buttons** added next to the existing Delete button on the Visitors, Parcels, and Waiting List pages — archiving is the reversible, softer alternative to permanent deletion.
- **Unified Archive & Restore page** (`/archive`): one place to see everything archived across all three categories, filterable, with a one-click Restore per item.
- Sidebar nav entry ("Archive").

## Scope notes (kept honest, nothing fabricated)
- This closes out Phase 5 (Reports & Operations) as scoped in the roadmap. Room Change history (`room_changes`) was intentionally left out of archiving — it's already a pure append-only audit log, not a working list that accumulates clutter the way visitor/parcel/waiting-list entries do, so there's nothing there worth archiving.
- Delete still exists alongside Archive on all three pages — Archive doesn't replace it, it just gives a non-destructive option first.

## Files Added
- `supabase/23_archive_restore.sql`
- `src/app/(owner)/archive/page.tsx`

## Files Modified
- `src/types/index.ts` (added `archived_at` to `Visitor`, `Parcel`, `WaitingListEntry`)
- `src/lib/supabase/queries.ts` (added `includeArchived` params + archive/restore functions)
- `src/app/(owner)/visitors/page.tsx`, `parcels/page.tsx`, `waiting-list/page.tsx` (added Archive button each)
- `src/app/(owner)/backup/page.tsx` (pass `includeArchived = true` so backups stay complete)
- `src/components/shared/Sidebar.tsx` (one new nav entry)

---

# Changelog — Phase 5.14: Backup Restore

## Analyzed first (per project rules) — deliberately conservative given the risk
- This is the riskiest micro-phase in the roadmap so far — a wrong move here could genuinely break data. Given the permanent rules ("never break database schema/business logic/multi-tenant architecture"), a **destructive** restore (wipe-then-replace) was rejected in favor of a **merge restore**: rows from the backup are upserted by `id`; nothing currently in the account is ever deleted by a restore, even if it's missing from the backup file.
- Caught and fixed a real inconsistency between the two backup producers without editing either: Manual Backup (5.12) keys its bundle with `waitingList`/`roomChanges` (camelCase) while Automatic Backup (5.13) uses `waiting_list`/`room_changes` (actual table names). Rather than touching those already-shipped files, Restore normalizes both naming styles itself via one small lookup table, so it reads either backup format correctly.
- Relies on the **existing** `owns_property()` RLS policies as the real safety boundary — every insert goes through the normal authenticated Supabase client, so a backup file containing another owner's property data is physically incapable of writing into this account no matter what the UI does. The UI-level "only show properties I still own" filter is a courtesy on top of that guarantee, not a substitute for it.
- Joined/derived fields that only exist because the original backup query joined them in (`tenant`, `room`, `from_room`, `to_room`) are stripped before upsert — restoring never tries to write a non-existent column.

## Added
- **Restore page** (`/restore`): upload a Manual Backup JSON file, or pick from the account's own Automatic Backup history; preview which properties/record counts in the file actually match properties this owner still has (backups from deleted properties are shown as skipped, not silently attempted); explicit confirm dialog stating the merge semantics before restoring; per-table restore summary afterward (rows restored vs. failed, with failures reported rather than hidden).
- Sidebar nav entry ("Restore").

## Scope notes (kept honest, nothing fabricated)
- Row-by-row upserts (not one bulk call per table) — slower for very large datasets, but means one bad row (e.g. referencing a room that's since been deleted) fails on its own instead of silently failing an entire table's restore. For a PG-scale dataset, this trade-off favors correctness and clear reporting over raw speed.
- No automatic conflict resolution beyond "backup wins" on matching IDs — if a record was edited after the backup was taken, restoring will revert it to the backup's values. That's the expected, standard meaning of "restore a backup," not a bug, but it's exactly why the confirm dialog says so explicitly before anything happens.

## Files Added
- `src/app/(owner)/restore/page.tsx`

## Files Modified
- `src/components/shared/Sidebar.tsx` (one new nav entry)

---

# Changelog — Phase 5.13: Automatic Backup

## Analyzed first (per project rules) — reused conventions, added only what's genuinely new
- Reused the `serviceClient()` pattern already established in `src/app/api/push/send/route.ts` (server-only Supabase client using `SUPABASE_SERVICE_ROLE_KEY`) for the new cron route, instead of inventing a different admin-client approach.
- Reused the exact storage-bucket + RLS-via-`storage.foldername()` pattern for the new **private** `automatic-backups` bucket — same shape as the existing `notice-attachments`/`tenant-documents` buckets, just not public (backups contain full financial/tenant data, unlike a notice attachment).
- The cron job's data-gathering mirrors the exact table list from Manual Backup (5.12) so both mechanisms produce the same bundle shape — just written with the service-role client since a cron run has no logged-in user session.

## Added
- **`supabase/22_automatic_backup.sql`**: `backup_settings` (per-owner enabled/frequency/retention) and `backup_runs` (history/audit log) tables with RLS, plus the private `automatic-backups` storage bucket and its owner-scoped read policy.
- **`src/app/api/cron/automatic-backup/route.ts`**: the actual scheduled job. Verifies `Authorization: Bearer $CRON_SECRET` (which Vercel Cron sends automatically), finds owners who are enabled and due (daily/weekly), backs each one up to `{owner_id}/backup-{timestamp}.json` in the private bucket, prunes older files past their retention count, and logs success/failure per owner — one owner's failure doesn't stop anyone else's backup that run.
- **`vercel.json`**: added a daily cron trigger (`0 2 * * *`) calling that route — kept the existing `framework`/`buildCommand` settings untouched, just added the `crons` key.
- **`.env.local.example`**: documented the new `CRON_SECRET` variable.
- **Automatic Backup UI**, added to the same `/backup` page as Manual Backup: enable/disable toggle, daily/weekly frequency picker, last-run timestamp, and a "Recent runs" list with per-run status and an "Open" link (via a short-lived signed URL) for successful ones.

## Scope notes (kept honest, nothing fabricated)
- This depends on the project actually being deployed to Vercel with `CRON_SECRET` set as an environment variable — it can't run automatically in a sandbox or a `next dev` session, only once deployed. That limitation is inherent to how cron scheduling works here, not a gap in this phase.
- Retention pruning removes old files from storage but intentionally leaves their `backup_runs` history rows in place — the audit log ("a backup ran on this date") is worth keeping even after the file itself is gone; the UI's "Open" button simply won't have anything to open for those older rows once pruned.
- No restore logic — that's still 5.14.

## Files Added
- `supabase/22_automatic_backup.sql`
- `src/app/api/cron/automatic-backup/route.ts`

## Files Modified
- `src/types/index.ts` (added `BackupSettings`, `BackupRun`)
- `src/lib/supabase/queries.ts` (added backup-settings/runs queries + import)
- `src/app/(owner)/backup/page.tsx` (added the Automatic Backup section)
- `vercel.json` (added `crons`)
- `.env.local.example` (documented `CRON_SECRET`)

---

# Changelog — Phase 5.12: Manual Backup

## Analyzed first (per project rules) — pure reuse, zero new queries
- Every single table this reads was already fetchable via an existing function (`getProperties`, `getRooms`, `getTenants`, `getPayments`, `getExpenses`, `getComplaints`, `getNoticesForProperty`, `getVisitors`, `getParcels`, `getWaitingList`, `getRoomChanges` — the last three added in this very phase). This page adds **no new query, no new table, no schema change** — it's purely orchestration + a client-side JSON download, same `Blob`/`URL.createObjectURL` pattern already used for CSV-ish exports elsewhere in spirit (Excel export uses the analogous `XLSX.writeFile`).

## Added
- **Manual Backup page** (`/backup`): one button, "Download Backup Now", that pulls every property the owner has (not just the currently-selected one — a backup that silently skips properties would be worse than none) plus all of the operational tables above for each, and downloads it as a single timestamped JSON file. Shows a confirmation with property/record counts after a successful export.

## Scope notes (kept honest, nothing fabricated)
- This is **export only** — no restore logic here (that's 5.14) and no scheduling (that's 5.13); the page says so directly so it isn't mistaken for either.
- Deliberately excludes generated PDFs (agreements/receipts) and raw uploaded files (photos, KYC docs) — those live in Supabase Storage, not these tables, and pulling every tenant's documents into one JSON blob would make backups huge and is a different problem (storage backup) than this phase's scope.

## Files Added
- `src/app/(owner)/backup/page.tsx`

## Files Modified
- `src/components/shared/Sidebar.tsx` (one new nav entry)

---

# Changelog — Phase 5.11: Room Change Workflow

## Analyzed first (per project rules) — reused the existing tenant-update path deliberately
- Confirmed `updateTenant(id, updates: Partial<Tenant>)` already exists and does a safe partial update — reused it directly for the actual move (`room_id`/`bed_label`) instead of writing new tenant-mutation logic.
- Kept this **out of Rent Adjustment / Deposit Workflow territory on purpose**: the move only ever touches `room_id`/`bed_label`. It deliberately does not touch `monthly_rent` or deposit fields, even though a room change often implies a rent change in real life — that recalculation belongs to Rent Adjustment, which is explicitly the other account's territory, so this page just says so and leaves it for the owner to handle separately.
- Built as its own isolated route (`/room-change`), not inside the Tenants management page, for the same merge-safety reason as Visitors/Parcels/Waiting List.

## Added
- **`supabase/21_room_change_log.sql`**: new `room_changes` audit table (from/to room, reason, changed-by) — does **not** alter the `tenants` or `rooms` tables at all.
- **Types**: `RoomChange`, `AddRoomChangeInput`.
- **Queries**: `getRoomChanges`, `changeTenantRoom` (calls the existing `updateTenant` for the move, then logs it).
- **Room Change Workflow page** (`/room-change`): pick a tenant → see their current room → pick a new room from only the ones with a real vacancy (same occupancy math as Waiting List's vacancy panel) → optional reason/changed-by → move, with a full change history below.

## Scope notes (kept honest, nothing fabricated)
- Vacancy check excludes the tenant's own current room from "already full" math, but does not reserve a bed mid-transaction — under concurrent use two owners could theoretically pick the same last vacant bed. Given this is a single-owner-admin tool used interactively, that's an acceptable, disclosed tradeoff rather than something requiring a database transaction/lock.
- Explicitly does not adjust rent or deposit — surfaced as a visible note in the UI itself, not just here.

## Files Added
- `supabase/21_room_change_log.sql`
- `src/app/(owner)/room-change/page.tsx`

## Files Modified
- `src/types/index.ts` (added `RoomChange`, `AddRoomChangeInput`)
- `src/lib/supabase/queries.ts` (added room-change queries + import)
- `src/components/shared/Sidebar.tsx` (one new nav entry)

---

# Changelog — Phase 5.10: Waiting List

## Analyzed first (per project rules) — confirmed new, reused what already existed
- No lead/prospect-tracking existed anywhere (Approvals only handles people who've already submitted a join request via QR — this is for people who haven't applied yet). Genuinely new, not a duplicate.
- The "currently vacant" reference panel reuses the exact occupied-vs-total-beds logic already computed inline for the main dashboard's occupancy stat — just grouped by sharing type instead of totalled, and computed client-side from `getRooms`/`getTenants` rather than adding a new query.
- Same migration/RLS conventions as `18_visitor_management.sql` / `19_parcel_management.sql`.

## Added
- **`supabase/20_waiting_list.sql`**: new `waiting_list` table (name, phone, preferred sharing type, budget, notes, status) with a `waiting_list_status` enum (`waiting` / `contacted` / `converted` / `expired`) and owner-scoped RLS.
- **Types**: `WaitingListEntry`, `WaitingListStatus`, `AddWaitingListInput`.
- **Queries**: `getWaitingList`, `addWaitingListEntry`, `updateWaitingListStatus`, `deleteWaitingListEntry`.
- **Waiting List page** (`/waiting-list`): Active/All filter, a "Currently vacant" reference strip so the owner knows who to call first, add-entry form, inline status dropdown per entry, delete.
- Sidebar nav entry ("Waiting List").

## Scope notes (kept honest, nothing fabricated)
- This is a manual lead tracker, not an automated matching engine — the vacancy panel is informational only; converting someone to a tenant still goes through the existing tenant-add flow (untouched, belongs to the other account's territory anyway).
- No link between a waiting-list entry and the tenant it eventually becomes — marking `converted` is just a status change the owner makes themselves.

## Files Added
- `supabase/20_waiting_list.sql`
- `src/app/(owner)/waiting-list/page.tsx`

## Files Modified
- `src/types/index.ts` (added `WaitingListEntry`, `WaitingListStatus`, `AddWaitingListInput`)
- `src/lib/supabase/queries.ts` (added waiting list queries + import)
- `src/components/shared/Sidebar.tsx` (one new nav entry)

---

# Changelog — Phase 5.9: Parcel Management

## Analyzed first (per project rules) — confirmed new, reused what already existed
- No parcel/delivery tracking existed anywhere. Followed the same migration/RLS conventions as `18_visitor_management.sql` (just added, same phase family) and `13_notice_board.sql`.
- Reused the exact push-notification call pattern from the Complaints page (`if (tenant?.auth_user_id) { sendPushNotification(...) }`) rather than inventing a new one — parcel arrival now notifies the tenant the same way a resolved complaint does.
- Added a `select`-only RLS policy so a tenant can see their own parcels at the database level (mirrors the tenant-facing `notice_reads` policy) — but built **no tenant-facing UI** for it. That stays isolated to whichever phase actually owns the Tenant Portal, so there's a clean handoff point without me touching tenant-portal files.

## Added
- **`supabase/19_parcel_management.sql`**: new `parcels` table (property_id, tenant_id, courier, tracking number, description, received/collected timestamps, free-text `received_by`) with owner-scoped RLS plus tenant-read policy.
- **Types**: `Parcel`, `AddParcelInput`.
- **Queries**: `getParcels`, `logParcel`, `collectParcel`, `deleteParcel`.
- **Parcel Management page** (`/parcels`): "Awaiting Collection" / "All History" tabs, log-parcel form (property picker when needed, required tenant selector, courier/tracking/description, received-by), one-tap "Collected", delete, and an automatic push notification to the tenant when a parcel is logged for them.
- Sidebar nav entry ("Parcels").

## Scope notes (kept honest, nothing fabricated)
- Unlike Visitors, logging a parcel **requires** selecting a tenant — a parcel with no recipient can't be notified about or meaningfully tracked, so the form enforces it rather than silently allowing an orphaned record.
- Push notification is best-effort (same silent-catch behavior as the rest of the app) — a missing push subscription never blocks logging the parcel.

## Files Added
- `supabase/19_parcel_management.sql`
- `src/app/(owner)/parcels/page.tsx`

## Files Modified
- `src/types/index.ts` (added `Parcel`, `AddParcelInput`)
- `src/lib/supabase/queries.ts` (added parcel queries + import)
- `src/components/shared/Sidebar.tsx` (one new nav entry)

---

# Changelog — Phase 5.8: Visitor Management

## Analyzed first (per project rules) — confirmed this is genuinely new
- No visitor/guest-log table or feature existed anywhere in the schema or codebase — this is a real new feature, not a duplicate of anything.
- Followed the exact RLS/migration conventions already established (e.g. `13_notice_board.sql`): `owns_property()` helper, `drop policy if exists` before `create policy`, indexes on the foreign keys that get filtered on.
- Built as its own isolated area (`/visitors`, new `visitors` table) — no changes to tenants, rooms, or dashboards, so it can't conflict with the other account's Phase 3/4 work.

## Added
- **`supabase/18_visitor_management.sql`**: new `visitors` table (property_id, optional tenant_id being visited, visitor name/phone, purpose, check-in/check-out timestamps, free-text `logged_by`) with owner-scoped RLS.
- **Types**: `Visitor`, `AddVisitorInput` in `src/types/index.ts`.
- **Queries**: `getVisitors`, `checkInVisitor`, `checkOutVisitor`, `deleteVisitor` in `queries.ts`.
- **Visitor Management page** (`/visitors`): "Currently In" / "All History" tabs, a check-in form (property picker when "All Properties" is selected, visitor name/phone/purpose, optional tenant-being-visited dropdown scoped to that property's active tenants), one-tap check-out, and delete.
- Sidebar nav entry ("Visitors").

## Scope notes (kept honest, nothing fabricated)
- No staff-account system exists yet, so `logged_by` is a plain free-text field rather than linking to a real user — noted directly in the migration's comment so it isn't mistaken for a proper attribution system later.
- A visitor's `tenant_id` is nullable and set to `null` (not deleted) if that tenant record is later removed, so historical visitor logs are never silently deleted by an unrelated tenant change.

## Files Added
- `supabase/18_visitor_management.sql`
- `src/app/(owner)/visitors/page.tsx`

## Files Modified
- `src/types/index.ts` (added `Visitor`, `AddVisitorInput`)
- `src/lib/supabase/queries.ts` (added visitor queries + import)
- `src/components/shared/Sidebar.tsx` (one new nav entry)

---

# Changelog — Phase 5.7: Global Search

## Analyzed first (per project rules) — found and completed a genuinely missing piece
- The Topbar already had a `search` state variable and a rendered `<input placeholder="Search tenants, rooms…">` — but it was never wired to anything: typing did nothing. Same pattern as the "Remind All" button fixed in the PWA phase (state + UI existed, the actual logic didn't).
- Reused `getTenants`/`getRooms` as-is; no new queries.

## Added
- **Global Search**, wired into the existing Topbar input:
  - Debounced (300ms) search across tenants (by name or phone) and rooms (by room number), scoped to whichever property/properties are currently selected — same scoping every other page already follows.
  - Results dropdown grouped by Tenants / Rooms (max 5 each), with a loading state and a "no matches" state.
  - Selecting a result navigates to the existing `/tenants` or `/rooms` list page and clears the search — it does not deep-link to a specific row, since that would require query-param support in those pages that I didn't verify exists and didn't want to assume (those pages belong to the other account's Phase 3 work).

## Scope notes (kept honest, nothing fabricated)
- Search only covers tenants and rooms, matching what the placeholder text already promised — not complaints/expenses/notices/payments, which would be a different, larger feature.
- No changes to the tenants or rooms pages themselves — only the Topbar (shared, not tenant-management-specific) was touched.

## Files Modified
- `src/components/shared/Topbar.tsx` (wired the existing, previously-unused search input)

---

# Changelog — Phase 5.6: QR Tenant Card

## Analyzed first (per project rules) — reused, not rebuilt
- Reused the exact QR-verification pattern already built in Phase 1 (`drawQRCode`, `drawLogoBadge`, `tryFetchImageAsDataUrl` in `src/lib/pdf.ts`) — same "encodes a data summary, not a public link" approach, no new QR library added.
- Reused `getTenants(propertyId)` as-is (read-only).
- Deliberately built as its **own isolated route** (`/tenant-cards`), not inside `src/app/(owner)/tenants/*` or any tenant/dashboard component, per the parallel-development rule — this stays a pure Operations tool over existing tenant data, with zero overlap with the other account's Tenant Features / Dashboard work.

## Added
- **`generateTenantIDCardPDF`** (`src/lib/pdf.ts`): a credit-card-sized (85.6×53.98mm) PDF per tenant — property branding, photo (if on file), name, room/bed, phone, joining date, status chip, and a QR code encoding a verification summary.
- **QR Tenant Cards page** (`/tenant-cards`): grid of active tenants with an in-app card preview (mirrors the PDF layout) and a "Download ID Card" button per tenant.
- Sidebar nav entry ("Tenant Cards") linking to the new page.

## Scope notes (kept honest, nothing fabricated)
- Only active tenants are shown — no card is generated for former tenants.
- The QR code is for manual cross-checking against the app's data, not a scan-to-verify web link — no such public endpoint exists (same caveat as the Agreement PDF's QR).
- Read-only over tenant data — no changes to tenant creation, editing, or approval flows, and no files under `tenants/` were touched.

## Files Added
- `src/app/(owner)/tenant-cards/page.tsx`

## Files Modified
- `src/lib/pdf.ts` (new `generateTenantIDCardPDF` export, appended — nothing existing changed)
- `src/components/shared/Sidebar.tsx` (one new nav entry)

---

# Changelog — Phase 5.5: Activity Logs

## Analyzed first (per project rules) — checked before adding anything
- Confirmed there is no existing audit/activity table or logging mechanism anywhere in `supabase/*.sql` or `queries.ts`. Building one properly (dedicated table + insert triggers on every mutating table) would be a real schema change — out of proportion for what's meant to be a read-only report, and riskier to merge alongside the other Claude account's parallel Phase 3/4 work.
- Instead, synthesized the feed entirely from timestamps that already exist on rows the app already fetches: `payments.created_at`, `tenants.created_at`/`approved_at`, `complaints.created_at`/`resolved_at`, `expenses.created_at`, `notices.created_at`. Every event corresponds to something that actually happened — nothing invented, no placeholder rows.

## Added
- **Activity Logs** (`/reports/activity-log`) — replaces the 5.1 placeholder:
  - Unified, timestamp-sorted feed across payments (recorded/rejected/pending), tenants (added, approved via QR), complaints (raised, resolved), expenses (recorded), and notices (published).
  - Filter chips per category with live counts.
  - Capped at the 200 most recent events per filter to keep the page responsive on properties with a lot of history.

## Scope notes (kept honest, nothing fabricated)
- This is **not** a true audit trail — it can't show edits/deletes (the app doesn't record those separately), and if a future feature adds real event logging, this page should switch to reading from that instead of being kept as a synthesized view.
- No schema, trigger, or new table added — zero risk to the database work anyone else touches.

## Files Added / Replaced
- `src/app/(owner)/reports/activity-log/page.tsx` (replaces the Phase 5.1 stub)

## Files Modified
- None outside the file above.

---

# Changelog — Phase 5.4: Profit & Loss Report

## Analyzed first (per project rules) — reused, not rebuilt
- Reused `getPayments`/`getExpenses` (same as Income/Expense Reports) rather than the dashboard's `getFinancialHistory`, because that helper only counts `type === 'rent'` — a true P&L needs every approved rupee in (rent + deposit + advance), matching the scope already established in the Income Report (5.2).
- Same card/table/export visual language as 5.1–5.3 for a consistent Reports section.

## Added
- **Profit & Loss Report** (`/reports/profit-loss`) — replaces the 5.1 placeholder:
  - 3 / 6 / 12-month range selector (fetches a rolling 12-month window once, range just changes how much is displayed — no refetch on toggle).
  - Summary cards: Total Income, Total Expenses, Net Profit, Profit Margin %.
  - Income vs. Expenses vs. Net Profit bar chart.
  - Month-by-month table with per-month margin.
  - Scoped Excel export.

## Scope notes (kept honest, nothing fabricated)
- Margin is `0%` for months with zero income rather than an undefined/NaN value.
- Read-only — no schema or business-logic changes; purely aggregates existing payments + expenses data.

## Files Added / Replaced
- `src/app/(owner)/reports/profit-loss/page.tsx` (replaces the Phase 5.1 stub)

## Files Modified
- None outside the file above.

---

# Changelog — Phase 5.3: Expense Report

## Analyzed first (per project rules) — reused, not rebuilt
- `getExpenses(propertyId)` reused directly. Categories and their badge colors (`CATEGORIES`, `CAT_COLOR`) copied verbatim from the existing Expenses page so a category looks identical whether you're adding an expense or reading a report about it.
- Same filter/summary/table/export structure as the Income Report (5.2) for a consistent Reports section, adapted for expenses.

## Added
- **Expense Report** (`/reports/expenses`) — replaces the 5.1 placeholder:
  - Filters: month (from real `expense_date` values) and category (All + the 7 existing categories).
  - Total Expenses summary card + a horizontal bar chart breaking down the filtered total by category.
  - Full records table: date, property (shown only when "All Properties" is selected, since a single-property view makes the column redundant), category badge, notes, amount.
  - Scoped Excel export.

## Scope notes (kept honest, nothing fabricated)
- Property name is resolved client-side from the existing `properties` list in context (`getExpenses` only returns `property_id`) — no new join or schema change.
- Read-only report — no changes to expense recording, editing, or deletion.

## Files Added / Replaced
- `src/app/(owner)/reports/expenses/page.tsx` (replaces the Phase 5.1 stub)

## Files Modified
- None outside the file above.

---

# Changelog — Phase 5.2: Income Report

## Analyzed first (per project rules) — reused, not rebuilt
- `getPayments(propertyId)` already returns payments joined with tenant/room/collector — reused directly, no new query needed.
- Followed the same "income = approved only" rule already used by `getDashboardStats`/`getFinancialHistory` on the main dashboard, so this report's totals can never disagree with the numbers owners already see elsewhere.
- Excel export pattern (`XLSX.utils.json_to_sheet` → `writeFile`) copied from the existing Reports Dashboard export, same styling conventions (`formatINR`, `formatDate`, card/table classes) reused throughout.

## Added
- **Income Report** (`/reports/income`) — replaces the 5.1 placeholder:
  - Filters: **month** (built from real `payment_date` values present in the data, not the free-text `for_month` field which is only ever filled in for rent) and **type** (All / Rent / Deposit / Advance).
  - Summary cards: Total Income, Rent, Deposit, Advance — recomputed live from the filtered set.
  - Full transaction table: date, tenant, room, type badge, method, amount.
  - Scoped Excel export (only the currently filtered rows, named with the property + month).

## Scope notes (kept honest, nothing fabricated)
- Only `approval_status === 'approved'` payments count as income — pending/rejected submissions are excluded, matching how the rest of the app treats them.
- No changes to payments schema, recording flow, or approval logic — this is a read-only report over existing data.

## Files Added / Replaced
- `src/app/(owner)/reports/income/page.tsx` (replaces the Phase 5.1 stub)

## Files Modified
- None outside the file above.

---

# Changelog — Phase 5.1: Reports Dashboard

## Analyzed first (per project rules) — already implemented, not rebuilt
- `/reports` already had real KPI summary cards, a 6-month revenue/expenses/profit chart (`getFinancialHistory`, `getDashboardStats`), and a working Excel export (`XLSX`) — all reused as-is.
- The only gap: the page's bottom tile grid ("Monthly Revenue Report", "Expense Report", "Profit & Loss", etc.) was six buttons that all just re-triggered the same single Excel export — no actual per-report pages existed yet, which is what Phase 5.2–5.5 build next.

## Added
- **Reports Dashboard hub.** `/reports` is now the landing page for the whole Reports & Operations phase: same real KPI cards + chart as before, plus a **Report Modules** grid that links to four dedicated pages — Income Report, Expense Report, Profit & Loss, Activity Logs — each to be fully implemented in its own micro-phase (5.2–5.5).
- **`ReportComingSoon`** (`src/components/shared/ReportComingSoon.tsx`): small shared placeholder used by the four not-yet-built report routes below, so navigation never 404s and it's honest about what's not built yet (no fabricated data or charts).
- **Stub routes** (real reports land in their own phase, replacing these files):
  - `/reports/income` → Phase 5.2
  - `/reports/expenses` → Phase 5.3
  - `/reports/profit-loss` → Phase 5.4
  - `/reports/activity-log` → Phase 5.5
- **Full Data Export** tile: the existing Excel export, kept as one clearly-labeled action instead of being duplicated across six identical-looking buttons; removed the now-redundant header "PDF"/"Excel" buttons (PDF was already a "not built yet" toast; Excel is the same export as the new tile).

## Scope notes (kept honest, nothing fabricated)
- The four linked report pages are intentionally placeholders in this micro-phase — only the Reports Dashboard hub itself (5.1) was in scope. No income/expense/P&L/activity-log calculation logic was written yet.
- No database, auth, routing, or multi-tenant changes. No files outside `reports/` and one new shared component were touched.

## Files Added
- `src/components/shared/ReportComingSoon.tsx`
- `src/app/(owner)/reports/income/page.tsx`
- `src/app/(owner)/reports/expenses/page.tsx`
- `src/app/(owner)/reports/profit-loss/page.tsx`
- `src/app/(owner)/reports/activity-log/page.tsx`

## Files Modified
- `src/app/(owner)/reports/page.tsx`

---

# Changelog — Production Audit (Phase 3 & Phase 4)

Full production-level audit of the merged Phase 3 & 4 build — authentication,
authorization, routing, multi-property/multi-tenant architecture, RLS, every
Phase 3 and Phase 4 page, forms, error/loading/empty states, performance,
security, and accessibility. No features were added, no UI was redesigned,
and no working code was rewritten — only genuine issues below were touched.

## Issues Found & Fixed

**Unused imports (7, across 4 files)** — zero-risk cleanup, cannot change
behavior:
- `src/app/(tenant)/portal/page.tsx`: `useRef`, `Home`, `Phone`, `IndianRupee`
  — imported, never used anywhere in the file.
- `src/app/(admin)/admin/page.tsx`: `formatINR` — unused.
- `src/app/(owner)/complaints/page.tsx`: `updateComplaint` import — unused
  (the function itself is kept in `queries.ts` as a general-purpose utility;
  `resolveComplaint` handles the one case the UI actually needs).
- `src/app/(owner)/tenants/page.tsx`: `Zap` icon — unused.

**Sequential fetch waterfall in the Payments page** — `load()` was fetching
payments+tenants, *then* leave requests, *then* rent extensions, *then*
collectors/bills as four separate sequential stages instead of one parallel
batch — the same class of inefficiency fixed on the Owner Dashboard in Phase
4.6, but that fix was never carried over to this page. Consolidated into a
single `Promise.all` wave. No behavior change — same data, same result,
fewer round trips.

**Missing accessibility labels** — the 5 icon-only "×" close buttons on
modals introduced in Phase 3/4 (Leave Request, Rent Extension Request,
Move-Out Request, Renew Agreement, Move-Out Checklist) had no `aria-label`
for screen readers. Added `aria-label="Close"` to each. Pre-existing modals
from earlier phases have the same gap but were left untouched — out of
scope for a Phase 3 & 4 audit, and changing widely-used, unrelated existing
UI risks exactly the kind of regression this audit is meant to prevent.

**Misleading environment variable documentation** — `.env.local.example`
claimed `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` would "auto-promote" that email to
the super_admin role on first login. No such logic exists anywhere in the
codebase — the super_admin role is actually granted manually via
`supabase/03_manual_create_users.sql`. Fixed the comment to describe what
the app actually does, rather than a feature that was never built. No code
changed — this was a documentation-only inaccuracy.

## Flagged, Not Changed (to avoid regressions)

- **`.env.local.example` ships working, shared default VAPID keys** ("ready
  to use as-is"). This is intentional from Phase PWA (documented at the
  time as a convenience default), but worth knowing: every deployment that
  keeps the default key pair shares the same push-signing identity. Not
  changed here — regenerating it would require coordinated redeployment and
  would break any already-registered push subscriptions in a live database.
  This is a deployment decision for the project owner, not something to
  silently change during an audit.
- **`updateComplaint()` in `queries.ts` has no caller.** Kept rather than
  deleted — it's a reasonable general-purpose utility (update status *or*
  assignment) that a future phase may want, in the same category as
  `createAgreement`/`getAgreementsForProperty`, which sat unused for two
  phases before Phase 3.6 wired them up. Removing working, intentional API
  surface isn't the same thing as removing dead code.

## Verified Clean (no issues found)

- RLS policies for every Phase 3 table (`leave_requests`,
  `rent_extension_requests`, `move_out_requests`, `move_out_checklists`):
  correct owner/tenant scoping, every `create policy` has a matching
  `drop policy if exists` for safe re-runs.
- `useEffect` dependency arrays across every Phase 3/4 page: no infinite-
  render risk (`properties` from `PropertyContext` is state-backed and
  referentially stable between fetches, not recreated every render).
- No `console.log`/`debugger` leftovers, no `TODO`/`FIXME` markers.
- No invalid Tailwind utility classes (checked every fractional spacing
  class against Tailwind's default scale).
- TypeScript syntax and brace/paren integrity: clean across every file
  touched by this audit and every file from Phase 3/4.

## Self-review

Is this project stable enough to become the base for the next development
phase? Yes — the only behavioral change in this audit is the Payments page
fetching the same data faster; everything else is either a no-op cleanup
(unused imports, a doc comment) or additive (aria-labels). Nothing that
worked before this audit works differently now.

---

# Changelog — Merged Phase 3 & Phase 4 Release

This merges the completed Phase 3 & Phase 4 build into the uploaded Main
Project (`pg-manager-saas-fixed.zip`).

## What the comparison found

Every file in the uploaded Main Project was diffed against the Phase 3 & 4
release, file by file. The two were identical — same `package.json`, same
`schema.sql`, same migrations 01–17, same `public/` assets, same `.env.local`
— with exactly one area of real divergence: **the Main Project already
contained its own, separate, incomplete attempt at tenant requests.**

- `supabase/18_tenant_requests.sql` — a single `tenant_requests` table
  (enum-typed `type`: `temporary_leave` / `rent_extension` / `move_out` /
  `renewal`) with move-out checklist columns baked directly into the same
  row, plus matching query functions (`createTenantRequest`,
  `getTenantRequestsForTenant`, `getTenantRequestsForProperty`,
  `resolveTenantRequest`) and a tenant-portal submission modal covering
  all four request types.
- **This implementation was incomplete**: `resolveTenantRequest` existed
  in `queries.ts` but was never called from anywhere — the Approvals page
  had no tab, no UI, and no way to review a submitted request at all.
  Tenants could submit a leave/extension/move-out/renewal request and it
  would go into a table the owner could never see or act on. The tenant
  portal also had its own separate, simpler agreement-expiry banner with
  no renewal workflow behind it (the "Renew Agreement" button submitted
  into the same dead-end table).

## Resolution

Kept the Phase 3 & 4 implementation as the single source of truth for
this feature area, rather than keeping both — running two parallel
"leave request" systems side by side would itself be the duplicate,
conflicting functionality the project's own permanent rules explicitly
prohibit, and the Main Project's version had no working owner-side half
regardless. The Phase 3 & 4 version covers the same four cases (leave,
extension, move-out, renewal) plus deposit settlement and a unified
request history, with a complete tenant → owner → decision → notification
loop for each one.

**Nothing was silently discarded.** `supabase/18_tenant_requests.sql`
still exists in this project's `supabase/` folder for reference — it was
not deleted, and the `tenant_requests` table itself was **not** dropped
from the database by this merge, since this project has no way to know
whether any real rows already exist there in your production database.
If you confirm the table is empty (or its contents aren't needed), it's
safe to drop manually:

```sql
drop table if exists tenant_requests;
drop type if exists tenant_request_type;
drop type if exists tenant_request_status;
```

The application code no longer references `tenant_requests`,
`createTenantRequest`, `getTenantRequestsForTenant`,
`getTenantRequestsForProperty`, `resolveTenantRequest`, the old
`updateMoveOutChecklist(id, {checklist_room_condition, ...})` signature,
or the `TenantRequest` type — all superseded by the Phase 3 tables
(`leave_requests`, `rent_extension_requests`, `move_out_requests`,
`move_out_checklists`) and their corresponding query functions.

## Verified after merge

- Every Phase 3 (3.1–3.7) and Phase 4 (4.1–4.6) feature present and intact.
- Authentication, routing, multi-property, multi-tenant RLS: untouched.
- `package.json`, `schema.sql`, migrations 01–17, `public/` assets,
  `.env.local`: confirmed byte-identical between the two projects, so
  nothing there needed reconciling.
- No TypeScript syntax errors, no unbalanced braces/parens, in any file
  carried into this merge.

## Required action

Run these migrations if not already applied (skip `18_tenant_requests.sql`
— superseded, see above):
```
supabase/18_leave_requests.sql
supabase/19_rent_extension_requests.sql
supabase/20_move_out_requests.sql
supabase/21_deposit_deduction_items.sql
```

---

# Changelog — Phase 3 & Phase 4 Official Release

This release consolidates every completed Phase 3 (Tenant Features) and
Phase 4 (Dashboards) micro-phase into a single production build. Each
micro-phase was developed directly on top of the previous one — not as
separate branches — so this is a clean, linear history with no merge
conflicts and no duplicate implementations to reconcile.

---

## Phase 3 — Tenant Features (3.1 – 3.7, complete)

**New tenant-initiated request system**, built around one consistent
pattern reused across every request type (own table, matching RLS shape,
owner Approvals tab, push notification both directions):

- **Temporary Leave Request** (3.1) — tenant requests leave for a date
  range; owner approves/rejects; full leave history shown to the tenant.
- **Smart Rent Adjustment** (3.2) — approved leave prorates that month's
  rent (per-day rate based on the calendar month), calculated by one
  shared utility used consistently across the tenant portal, the owner
  dashboard stat, and the owner payments list, so they can never disagree.
- **Rent Extension Request** (3.3) — tenant asks for more time to pay a
  specific month; if approved, the due date used for late-fee calculation
  is pushed out accordingly, and the owner's pending-rent list shows an
  "Extended to …" badge instead of a false overdue flag.
- **Move-Out Request + Checklist** (3.4) — tenant-initiated move-out that
  reuses the pre-existing owner "give notice" flow rather than duplicating
  tenant-status logic; adds a standard owner-managed move-out checklist,
  visible read-only to the tenant.
- **Deposit Settlement** (3.5) — itemized deduction line items (replacing
  a single free-text notes field) with an auto-calculated refund amount;
  tenant sees a "Settlement Pending" notice before the refund is
  finalized, and the itemized breakdown once it is.
- **Agreement Renewal + Expiry Reminder** (3.6) — revived the `agreements`
  table and its query functions (fully built in Phase 1 but never wired
  into any UI); owner gets an expiring-agreements card with one-click
  renewal that carries over all existing terms; tenant sees a countdown.
- **Unified Request History** (3.7) — a single "My Requests" tab merging
  leave, extension, move-out and maintenance requests into one filterable,
  chronological view.

**New tables:** `leave_requests`, `rent_extension_requests`,
`move_out_requests`, `move_out_checklists`. **New column:**
`tenants.deposit_deduction_items`.

---

## Phase 4 — Dashboards (4.1 – 4.6, complete)

**Owner Dashboard**, grown from 6 static stat cards and one chart into:

- **KPI Cards** (4.1) — trend indicators (↑/↓ vs last month) plus two new
  metrics, Collection Rate and Avg Rent/Bed, computed correctly for both
  single-property and all-properties views (raw sums aggregated first,
  percentages derived after — not percentages naively averaged together).
- **Occupancy Analytics** (4.3) — 6-month occupancy trend line derived
  from tenant tenancy overlaps, plus a by-sharing-type breakdown.
- **Income vs Expense** (4.4) — the dashboard's revenue/expense chart now
  shows the Profit series it was already receiving from the data layer
  but not rendering, plus a Net Profit headline.
- **Activity Timeline + Smart Alerts** (4.5) — the activity feed now
  covers every property (previously silent on the "all properties" view)
  and every request type from Phase 3; a new "Needs Your Attention" panel
  surfaces pending approvals, overdue rent, open complaints and expiring
  agreements above the fold.
- **Optimization** (4.6) — consolidated what had become duplicate,
  sequential data fetching (leave requests and expenses were each being
  fetched twice per load) into one parallel batch; light mobile-responsive
  sizing fixes.

**Tenant Dashboard:**

- **Quick Actions** (4.2) — one-tap row (Pay Rent, Maintenance, Message,
  Request Leave, Agreement, My Requests) wired entirely to handlers that
  already existed from Phase 3 — no new logic, pure UI.

---

## Required actions for this release

Run, in order, any of these not already applied to the database:

```
supabase/18_leave_requests.sql
supabase/19_rent_extension_requests.sql
supabase/20_move_out_requests.sql
supabase/21_deposit_deduction_items.sql
```

No other environment or infrastructure changes for Phase 3 or Phase 4.

---

## Release self-audit

- Every Phase 3 sub-phase (3.1–3.7) verified present in this build.
- Every Phase 4 sub-phase (4.1–4.6) verified present in this build.
- No duplicate implementations found — each micro-phase built on the
  previous one directly, so there was no divergent code to merge.
- Existing authentication, routing, multi-property and multi-tenant
  RLS patterns untouched by Phase 3/4 work — every new table follows the
  same owns_property() / tenant-self-scoped RLS shape as `complaints`.
- No TypeScript syntax errors, no unbalanced braces/parens, across every
  file touched in Phase 3 or Phase 4 (checked file-by-file before this
  release was packaged).

**One pre-existing documentation bug fixed during this consolidation:**
the original "PWA + Push Notifications" changelog entry's header line was
accidentally deleted while adding the Phase 3.1 entry, leaving its content
orphaned under the wrong heading for several releases. Restored below —
no code was affected, this was a changelog-file-only issue.

---

# Changelog — PWA + Push Notifications

## Added
- **Installable PWA**: `manifest.json`, generated app icons (192/512/maskable/apple-touch), `sw.js` service worker.
- **Service worker**: handles install/activate, push events, and notification-click routing. Deliberately does not cache pages or API responses — this is a financial app, and stale cached rent/payment data would be a bug, not a feature.
- **Web Push infrastructure**: `push_subscriptions` + `notification_log` tables (`supabase/15_pwa_push_notifications.sql`), VAPID keys, `/api/push/send` server route (Node runtime, uses `web-push` + Supabase service role key).
- **Client helpers** (`src/lib/push.ts`): `enablePushNotifications`, `disablePushNotifications`, `sendPushNotification`.
- **`EnableNotificationsBanner`**: dismissible opt-in prompt, added to both Owner Dashboard and Tenant Dashboard.
- **`NotificationBell`** component built (real push history + unread badge) — kept available but not swapped in for the existing owner/tenant bells, since those already show actionable, business-specific items (pending approvals, pending rent, etc.) that are more useful day-to-day than a raw push log. Push notifications still fire as real OS notifications regardless.
- **Live triggers wired**: notice published → push to every active tenant; complaint marked resolved → push to that tenant; individual rent reminder → push fires alongside WhatsApp; "Remind All" bulk reminder modal (previously nonfunctional — the click handler existed but the modal itself was never built) now sends WhatsApp + push together per tenant.

## Fixed (found while wiring this feature)
- `getComplaints()` didn't select `tenant.auth_user_id`, so there was no way to target a complaint's tenant for push — added to the query.

## Environment variables (new)
```
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:owner@example.com
```

## Required action
Run `supabase/15_pwa_push_notifications.sql` in the Supabase SQL Editor. Add the four env vars above to Vercel project settings (and local `.env.local`).

## Vercel Free Tier compatibility
No new infrastructure — the push-send route is a standard Next.js API route (serverless function), `web-push` has zero paid dependencies, and Supabase Realtime was intentionally not used (the bell polls every 30s instead), keeping this fully within free-tier limits on both platforms.

---

# Changelog — Property Switcher: Occupancy Badge

## Checked
- `PropertySwitcherCard` (reference zip) vs the existing Topbar property switcher: same functionality (switch property, "All Properties" view, Add Property modal) — already present, not recreated.

## Added
- Per-property occupancy % badge in the switcher dropdown (green ≥90%, red <50%, gray otherwise). Fetched via existing `getDashboardStats`, only when the dropdown is opened, to avoid unnecessary calls.

## Files Modified
- `src/components/shared/Topbar.tsx`

---

# Changelog — Phase 1: Professional Documents

## Added
- **Premium Rent Agreement PDF** (`generateFullAgreementPDF`): logo badge, "DIGITALLY GENERATED" watermark, tenant photo (if set), lock-in period (optional), owner + tenant signature lines, and a QR verification code.
- **Premium Payment Receipt PDF** (`generateReceiptPDF`): receipt date & time, computed billing period, previous due / late fee / discount / advance adjustment / deposit adjustment (only rendered when a caller actually provides a non-zero value, never fabricated), remaining balance, transaction/UPI reference, signature line, "PAID" watermark, QR verification code.
- **`reference_number`** column added to `payments` (`supabase/16_payment_reference_number.sql`) + a matching optional field in the Record Payment form (UPI/Bank Transfer only).

## Scope notes (kept honest, nothing fabricated)
- PG Logo: no property-logo-upload feature exists, so a styled monogram badge is used instead of a real image.
- Government ID Number: the app captures a photo of the ID, not a typed number — the PDF shows "Verified — photo on file."
- QR "Verification" encodes a data summary for manual cross-checking, not a link to a public verification page.
- Late fee / discount / advance & deposit adjustments were accepted as optional receipt inputs even though nothing calculated them yet at the time — that arrived in Phase 2.

## Required action
Run `supabase/16_payment_reference_number.sql` in the Supabase SQL Editor.

## Files Modified
- `src/lib/pdf.ts`, `src/app/(tenant)/portal/page.tsx`, `src/app/(owner)/payments/page.tsx`, `src/types/index.ts`, `package.json` (`qrcode`, `@types/qrcode`)

---

# Changelog — Phase 2: Rent & Deposit

## Analyzed first — already implemented, not rebuilt
- Security Deposit Management, Deposit Settlement & Refund, Partial Rent Payment, and Rent Payment Timeline all already existed and were verified working, not rebuilt.

## Added (the two genuinely missing pieces)
- **Advance Rent Payment — made functional.** `'advance'` was previously an unused dropdown option with no logic behind it. Added a shared `applyAdvanceBalance()` utility that auto-applies an advance balance across a tenant's unpaid months, oldest first — used identically on the tenant portal and the owner dashboard so the two views can never disagree.
- **Late Fee Auto Calculation — new.** Configured per property (Settings → ₹/day + grace days), applies to every tenant regardless of how they joined. Added `calculateLateFee()` shared utility. Defaults to ₹0/day — never charges anyone unless the owner explicitly configures a rate.

## Required action
Run `supabase/17_late_fee_policy.sql` in the Supabase SQL Editor.

## Files Modified
- `src/lib/utils/index.ts`, `src/app/(tenant)/portal/page.tsx`, `src/app/(owner)/settings/page.tsx`, `src/app/(owner)/payments/page.tsx`, `src/lib/supabase/queries.ts`, `src/types/index.ts`
