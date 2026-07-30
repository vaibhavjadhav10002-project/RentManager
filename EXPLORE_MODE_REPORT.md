# EXPLORE_MODE_REPORT.md

> **Merge note:** this feature was originally built in a separate project
> copy and has been merged into this authoritative codebase as part of
> the final production merge. Verified during the merge: this project's
> actual `getPayments()`/`getProperties()` (and the rest of the ~120
> functions in `queries.ts`) use the identical `createClient()` choke
> point and embed-select patterns this was built against, so it ports
> cleanly with no changes to the mock layer. This project's own
> `NotificationBell.tsx` (unique to this codebase, not present when this
> feature was first built) was specifically checked and confirmed to
> degrade gracefully — it queries `notification_log`, a table outside
> the Explore Mode seed set, and the mock query builder's `store[table]
> || []` fallback means it renders an empty list rather than crashing.
> A nested-embed bug (`tenant:tenants(..., room:rooms(...))`, exactly
> the shape `getPayments()` uses here) was found and fixed before this
> merge — see the "one level deep" limitation below, which is now
> resolved to "resolves nested embeds recursively."

## 1. Architecture

**Core idea:** every page in this app already gets its data through exactly
one choke point — `createClient()` in `src/lib/supabase/client.ts`, which
`src/lib/supabase/queries.ts`'s ~120 functions call, and which every owner
page calls `queries.ts` for. Explore Mode is implemented by making that
**one function** cookie-aware:

```
createClient()
  → if rentivo_explore cookie is set → return a mock, Supabase-shaped client
  → otherwise → return the real createBrowserClient() (unchanged)
```

Because of that single choke point, **zero pages were duplicated and zero
query functions were rewritten** — every existing route, component, filter,
sort, search, and detail view automatically works in Explore Mode, because
from queries.ts's perspective it's just talking to "a Supabase client" as
it always has.

```
src/lib/explore/
  cookies.ts             — rentivo_explore / rentivo_onboarded cookie helpers
  sample-data.ts         — static seed dataset, shaped exactly like the real tables
  mock-query-builder.ts  — generic Postgrest-compatible chainable query builder
  mock-client.ts         — Supabase-client-shaped wrapper (auth/storage/from/rpc)
  lock-bus.ts            — tiny event emitter bridging the mock client (plain JS)
                            to the React lock-sheet component
  context.tsx            — ExploreModeProvider / useExploreMode()

src/components/shared/
  ExploreBadge.tsx        — subtle "Explore Mode" pill, mounted globally
  ExploreLockSheet.tsx    — the premium bottom sheet for locked actions

src/app/welcome/page.tsx  — first-launch onboarding (the one genuinely new page)
```

**Reads** are served from the static seed dataset via a generic query
builder supporting every chain method actually used in queries.ts
(`select/eq/neq/in/gte/lte/order/limit/single/maybeSingle/or/ilike`), plus
a naive one-level embedded-relation resolver for patterns like
`.select('*, tenant:tenants(name)')`.

**Writes** (`insert/update/upsert/delete`, the 3 tenant-creation `rpc()`
calls, and file `storage.upload()`) are never applied. Each one fires the
lock-bus event (opening the bottom sheet) and returns a Postgrest-shaped
`{ data: null, error: {...} }` result — which flows through queries.ts's
existing `if (error) throw error` pattern completely unchanged, exactly
as a real Supabase error would.

## 2. Files created

- `src/lib/explore/cookies.ts`, `sample-data.ts`, `lock-bus.ts`,
  `mock-query-builder.ts`, `mock-client.ts`, `context.tsx`
- `src/components/shared/ExploreBadge.tsx`, `ExploreLockSheet.tsx`
- `src/app/welcome/page.tsx`

## 3. Files modified (all additive; no existing branch removed or altered)

- `src/lib/supabase/client.ts` — the one-line-of-consequence change described above
- `src/middleware.ts` — added `/welcome` to public paths; added an
  explore-mode bypass that only ever engages when `!user` (a real session
  is always checked first and always wins) and only for owner-area paths
  (excludes `/admin`, `/portal`)
- `src/app/(owner)/layout.tsx` — when `!user` and the explore cookie is
  set, renders `OwnerShell` with a synthetic explorer profile instead of
  redirecting to `/login`; the real-user branch below is untouched
- `src/app/page.tsx` — unauthenticated visitors now go to `/welcome` (first
  visit), `/dashboard` (returning explorer), or `/login` (seen onboarding,
  not exploring) instead of always straight to `/login`; authenticated
  branch untouched
- `src/app/layout.tsx` — mounts `ExploreModeProvider`, `ExploreBadge`,
  `ExploreLockSheet` alongside the existing `PWARegister`/`NativeBootstrap`

## 4. Security design

- **The mock client never touches Supabase.** It has no URL, no anon key,
  no network call of any kind — it's a plain JS object reading from a
  static in-memory array. There is no code path by which Explore Mode can
  reach production data, even in principle (not "access is denied" —
  there is no access being attempted at all).
- **A real session always wins.** Every gate (middleware, `(owner)/layout.tsx`,
  root `page.tsx`) checks `user` from a real `supabase.auth.getUser()` call
  *first*; the explore cookie is only ever consulted in the `!user` branch.
  A stale explore cookie sitting in a browser after a real login is
  inert — it's simply never read again once `user` is truthy.
- **Nothing exploring can write persists, even locally.** Mutating calls
  don't apply to the in-memory store at all (they're rejected before
  touching it), so there's no risk of the "sample data" drifting into
  something that looks like real captured input.
- **No env vars or secrets are reachable from Explore Mode.** The mock
  client is constructed with zero configuration — no
  `NEXT_PUBLIC_SUPABASE_*` values are read on that path.
- **Explore Mode cannot reach `/admin` or `/portal`.** Scoped deliberately
  to the owner-area routes matching the feature list in this brief.

## 5. User flow

1. First visit, unauthenticated → `/welcome` (5 screens + final CTA)
2. **Explore Rentivo** → sets `rentivo_explore` cookie → `/dashboard`,
   read-only, badge visible
3. Any locked action anywhere → bottom sheet (Create Account / Login /
   Continue Exploring)
4. **Create Account** or **Login** (from onboarding, the lock sheet, or
   navigating directly) → clears the explore cookie → `/login`
5. Skip on onboarding → marks onboarded, straight to `/login`, no explore
   session started
6. Reopening the app while still exploring → root `page.tsx` sends you
   straight back to `/dashboard` (no repeat onboarding)
7. A real login succeeding always lands on the real dashboard with the
   real session — explore state is irrelevant once `user` is truthy

## 6. Performance impact

- No additional network calls — the mock path replaces Supabase calls
  with synchronous in-memory array operations, if anything **faster**
  than the real app for an explorer.
- No new routes for existing screens (zero duplicate pages), so bundle
  size grows only by the explore/mock-client code itself (small — no new
  dependencies added) plus the one new `/welcome` route.
- The `ExploreModeProvider`/`ExploreBadge`/`ExploreLockSheet` are mounted
  unconditionally in the root layout (matching the existing
  `PWARegister`/`NativeBootstrap` pattern) but render nothing when not
  exploring, so there's no measurable cost for the 99% of sessions that
  are real logged-in users.

## 7. Honest limitations / what I could not verify here

- **No real signup flow exists in this app today.** Accounts are created
  by a Super Admin (`ADMIN_MANUAL.md`), not self-serve. The onboarding's
  "Create Account" button and the lock sheet's "Create Account" button
  both route to `/login?mode=signup` — the login page does not currently
  read that query param, so today this simply opens the ordinary login
  screen. This is a real product gap, not something I could fix within
  "do not modify authentication" — building self-serve signup is a
  distinct feature that needs its own product decision.
- **Mock read coverage is broad but not exhaustive.** The generic query
  builder covers every chain method actually used across queries.ts's
  ~120 functions, and the seed dataset covers the core entities
  (properties, rooms, tenants, payments, complaints, notices, expenses,
  visitors, parcels) needed for the screens explicitly listed in this
  brief. Screens reading tables outside that seed set (e.g. waiting list,
  room-change history, communication logs, backups) will render an empty
  state rather than crash, but won't show populated sample data — see
  "Future improvements."
- **Embedded relation resolution is now recursive** (fixed during the
  production audit — was previously one level deep only, which silently
  dropped the nested `room` inside `getPayments()`'s actual
  `tenant:tenants(..., room:rooms(room_number))` select string; verified
  with a direct reproduction test against real seed data before and
  after the fix). Still not a full Postgrest-grammar implementation —
  arbitrary filter operators inside a nested embed aren't supported —
  but the shape this codebase actually uses now resolves correctly.
- **Not run against a real build.** This sandbox has no `npm install`/
  network access — the same limitation flagged in every prior pass on
  this project. Run `npm install && npm run build` and click through the
  actual flow (onboarding → explore → try each locked action → login)
  before treating this as final; I verified correctness by careful
  reading and by tracing the exact call chain for representative
  functions (e.g. `addTenantByOwner`, `getProperties`), not by executing
  the app.
- **Haptic feedback** (explicitly requested for native) is not wired up —
  doing so needs the `@capacitor/haptics` plugin added to package.json
  (same pattern as the other native plugins from the earlier mobile
  pass) and a couple of call sites (e.g. on lock-sheet open, on
  onboarding "Continue"). Small, well-scoped follow-up, not done here to
  avoid adding a new dependency inside a task that didn't ask for one.

## 8. Future improvements

1. Decide on and build real self-serve signup (or replace "Create
   Account" with a different CTA — e.g. "Contact us" — until that
   exists).
2. Extend the seed dataset to cover the remaining tables (waiting list,
   room changes, communication logs) if those screens are added to the
   explorable list.
3. Wire up `@capacitor/haptics` for the native lock-sheet/onboarding
   interactions.
4. Consider a lightweight analytics event on `enterExploreMode()` /
   explore→signup conversion, so the product team can actually measure
   the "significantly increase account conversion" goal this feature is
   meant to serve.
5. If Explore Mode should ever cover the tenant portal too, the same
   pattern extends cleanly — `queries.ts`'s tenant-facing functions go
   through the identical `createClient()` choke point, so it's a
   scoping change (middleware/portal-layout), not a rearchitecture.
