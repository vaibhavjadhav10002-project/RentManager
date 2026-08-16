# RENTIVO — MASTER FIX SUMMARY
### Everything fixed/added in this session — reference doc for updating your Main file elsewhere

Use this as a checklist: for each item, confirm your Main file already
has it, or apply it fresh. Every SQL migration is additive (safe to run
even if some of it already exists — each uses `create or replace` /
`drop policy if exists` / `add column if not exists`).

---

## 1. SQL MIGRATIONS TO RUN (in order)

Run these in Supabase Dashboard → SQL Editor, **in this order**:

| # | File | What it does |
|---|---|---|
| 1 | `supabase/39_production_approval_fixes.sql` | RLS lockdown (see §2) + deposit-refund trigger + `late_fee_amount` column |
| 2 | `supabase/40_fix_tenant_onboarding_self_update.sql` | Fixes broken tenant onboarding submission (see §5) |

⚠️ **Check your own migration numbering first.** In my working copy,
`38_` was already taken by an unrelated fix (`38_fix_qr_join_tenant_insert_rls.sql`),
so mine became `39_` and `40_`. **If your Main file's `38_`/`39_`/`40_`
slots are used by something else, rename these two files to your next
free numbers before running** — the content doesn't reference its own
filename anywhere, so renaming is safe.

---

## 2. 🔴 CRITICAL — RLS Self-Approval Bypass (fixed)

**Problem:** Tenants could insert/approve their own `payments`,
`leave_requests`, `rent_extension_requests`, `move_out_requests`,
`profile_update_requests` rows directly as `approved`, completely
bypassing owner review.

**Fix (in `39_production_approval_fixes.sql`):**
- Every tenant-insert policy on those 5 tables now requires the row
  land in its neutral state (`pending_approval` / `pending`).
- Every owner-decide policy now requires the row still be pending
  (blocks re-approving/re-rejecting an already-decided row too).

**No app code changes needed** — your existing `add*Request()` functions
never explicitly set `status`, they rely on the column default, so
nothing breaks.

---

## 3. 🔴 CRITICAL — Overlapping Leave Double-Counted Rent

**Problem:** Two overlapping approved leave requests (e.g. 5–9 Sep +
7–9 Sep) summed their days independently → 8 days counted instead of 5
unique days → tenant's rent reduced too much.

**Fix:** `calculateLeaveRentAdjustment()` in `src/lib/utils/index.ts` —
merges overlapping/adjacent date ranges before counting days.

**Verified:** 5–9 Sep + 7–9 Sep → now correctly returns 5 unique days
(₹1,550 adjustment on ₹9,300/mo rent), not 8 (₹2,480).

---

## 4. 🔴 NEW FEATURE — Rent-Cycle-Based Move-Out Notice

**Rule:** Notice must be given *before* a rent-cycle boundary to be
honored at the end of that cycle. Missing the cutoff by even one day
pushes eligibility a full cycle further out.

**Confirmed example:** Joining 5 Aug (cycle day = 5) → request 6 Sep →
**eligible date = 5 Nov** (not 6 Oct).

**New function:** `computeEligibleMoveOutDate(joiningDate, requestDate)`
in `src/lib/utils/index.ts`. Wired into:
- `src/app/(tenant)/portal/page.tsx` — Move-Out request form (min-date + validation)

**Full boundary matrix** (cycle day 5, joined 5 Aug) — all 10 cases
verified, see `APPROVAL_CALCULATION_AUDIT.md` for the table.

---

## 5. 🔴 HOTFIX — Tenant Onboarding Submission Broken
### ("Cannot coerce the result to a single JSON object")

**Root cause (pre-existing bug, not introduced by any of the above):**
An older migration (`07_critical_security_fix.sql`) removed tenants'
ability to update their own `tenants` row entirely, on the wrong
assumption that "the app never needs this." But `submitOnboardingProfile()`,
`markOnboardingPasswordChanged()`, `markOnboardingDraftStarted()` all
update the tenant's own row — every one of those calls has been
silently failing (RLS matches 0 rows → `.select().single()` throws
this exact PostgREST error).

**Fix (`40_fix_tenant_onboarding_self_update.sql`):**
- Restores tenant self-update access on `tenants`.
- Adds a **column-allowlist trigger** so a tenant can only ever change
  `pending_profile` and `onboarding_status` on their own row — every
  other column (`monthly_rent`, `deposit_amount`, `room_id`, `status`,
  etc.) stays locked.
- Further restricts `onboarding_status` so a tenant can only set it to
  `password_changed` / `draft` / `submitted` / `resubmitted` — never
  `approved`, `correction_requested`, or `invitation_created` (owner-only).

**If your Main file already has a working onboarding form (no error),
you may already have a different fix for this — check your `tenants`
UPDATE policy before applying this migration, to avoid double-fixing.**

---

## 6. 🟠 HIGH — Owner Pending-Rent Ignored Backlog Months

**Problem:** Owner Dashboard/Payments page only checked the *current*
month's rent — an older unpaid month was invisible if a later month
got paid.

**Fix:** New shared functions in `src/lib/utils/index.ts`:
- `buildMonthlyLedger(tenant, payments, approvedLeaves)`
- `getRentOutstandingSummary(tenant, payments, approvedLeaves)`

Both **Owner Dashboard** (`getDashboardStats` in `src/lib/supabase/queries.ts`)
and **Owner Payments page** (`src/app/(owner)/payments/page.tsx`) now
call this same function the Tenant Portal already used — all three
views can never disagree again.

---

## 7. 🟠 HIGH — Deposit Refund Over-Allocation

**Problem:** Refund was only checked against `deposit_paid`, never
against `deposit_paid − Σdeductions` — a refund + deductions could
together exceed the deposit actually held.

**Fix:**
- Client-side check in `src/app/(owner)/tenants/page.tsx` (deposit
  settlement save).
- DB-level trigger `trg_prevent_deposit_over_settlement` in
  `39_production_approval_fixes.sql` (second line of defense —
  blocks it even via direct API).

---

## 8. 🟠 HIGH — No Approval State-Transition Guards

**Problem:** `approved → rejected`, `rejected → approved`, duplicate
approval — none were blocked. An owner could silently reverse an
already-acted-on decision.

**Fix:** `approvePayment`, `rejectPayment`, `decideLeaveRequest`,
`decideRentExtensionRequest`, `decideMoveOutRequest`,
`decideProfileUpdateRequest` (all in `src/lib/supabase/queries.ts`)
now require the row still be pending before acting, with a clear
"already been decided" error otherwise. Matches the RLS-level guard
from `39_production_approval_fixes.sql`.

---

## 9. 🟡 MEDIUM — Late Fee Accounting

**Problem:** Late fee was folded into `type='rent'` payments with no
way to distinguish it — inflated "rent income" in reports.

**Fix:**
- New column: `payments.late_fee_amount numeric(10,2) default 0`
  (in `39_production_approval_fixes.sql`).
- `src/types/index.ts` — added `late_fee_amount: number` to `Payment`.
- Tenant rent-payment submissions now record the fee separately
  (`src/app/(tenant)/portal/page.tsx`).
- Income Report (`src/app/(owner)/reports/income/page.tsx`) now shows
  "Rent" and "+ Late Fees" as separate figures.

---

## 10. 🟡 MEDIUM — Inconsistent Date Parsing

**Problem:** `new Date("YYYY-MM-DD")` parses as UTC midnight;
`new Date(y, m, d)` parses as local midnight — mixed use across
rent-cycle/leave/move-out/extension calculations risked a 1-day drift
depending on the viewer's timezone.

**Fix:** New helper `parseDateOnly()` in `src/lib/utils/index.ts` —
swapped into every affected call site: `computeDueDate`,
`calculateLeaveRentAdjustment`, the late-fee/extension date check in
the Tenant Portal, and the Owner Dashboard's occupancy-trend filter.

---

## 11. 🔴 NEW FEATURE — Joining Payment Balance

**What it tracks:** Deposit and first-month ("joining") rent as two
separate, clearly-outstanding amounts, reusing your existing
`deposit_amount`/`deposit_paid` and `monthly_rent`/`rent_paid_at_joining`
columns (no schema change needed for the numbers themselves).

**New function:** `computeJoiningPaymentStatus(tenant)` in
`src/lib/utils/index.ts` — returns deposit/rent required, paid,
outstanding, total outstanding, a 5-calendar-day deadline from the
joining date, and a `paid`/`outstanding`/`overdue` status.

**Confirmed example:** Deposit ₹5,000 (paid ₹4,000) + Joining Rent
₹5,000 (paid ₹4,000) → **Total Outstanding ₹2,000**, joining 5 Aug →
**deadline 9 Aug**.

**Wired into (same function, both sides — can't disagree):**
- Owner: `src/app/(owner)/tenants/page.tsx` (tenant detail sheet card)
- Tenant: `src/app/(tenant)/portal/page.tsx` (dashboard alert card)

---

## 12. Deposit-Paid Sync Bug (found while building §11, fixed)

**Problem:** Approving a tenant's `type='deposit'` payment never
updated `tenants.deposit_paid` — the tenant would see "deposit due"
forever even after approval.

**Fix:** `approvePayment()` in `src/lib/supabase/queries.ts` now
increments `tenants.deposit_paid` by the approved amount when
`type === 'deposit'`.

---

## 13. 🔴 NEW FEATURE — Mandatory APK Download Gate

**What it does:** When a tenant opens their onboarding form (invited
flow) or the QR self-join form, on **Android mobile browsers only**:
- APK download auto-starts in the background as soon as the page loads.
- The Submit/Complete button stays **disabled** until the download has
  started (auto, or via a manual "Download now" fallback button).
- **iOS and desktop are never gated** — an APK can't be installed there,
  so blocking would just break onboarding for them.
- WhatsApp invite messages (owner-invite, QR-join-approval, and the
  "Send via WhatsApp" fallback) now include the APK link too.

**New file:** `src/lib/apk/useApkDownloadGate.ts` — shared hook, used by:
- `src/components/tenant/OnboardingWizard.tsx`
- `src/app/(auth)/join/[slug]/page.tsx`

**WhatsApp message updates:**
- `src/app/(owner)/tenants/page.tsx`
- `src/app/(owner)/approvals/page.tsx`

**Config — you must fill this in:**
`public/app-version.json` → `apkDownloadUrl`. Set up as GitHub's
"latest release" redirect pattern (never needs updating again after
each new release, as long as you always name the uploaded asset the
same thing):
```
https://github.com/<your-username>/<your-repo>/releases/latest/download/rentivo-latest.apk
```
Replace `<your-username>` / `<your-repo>`, and always upload each new
release's APK as `rentivo-latest.apk`.

**Built-in safety (found + fixed during QA — see §14):** a 5-second
timeout on the version-check fetch, so a bad network can never
permanently block onboarding.

---

## 14. QA Pass — Bugs Found & Fixed in the APK Gate (before it shipped)

1. **Stale placeholder-detection string** — after changing
   `app-version.json`'s placeholder text, 3 places still checked for
   the *old* placeholder string, so a real URL would never have been
   detected as configured. Fixed to match generically on `REPLACE-WITH`.
2. **No fetch timeout** — could have blocked onboarding forever on a
   bad connection. Fixed with a 5s `AbortController` timeout.
3. **UI flash** — submit button could briefly show enabled then flip
   to disabled right after page load. Fixed with an explicit `checked`
   (fetch-settled) flag so the disabled state is deterministic.

---

## 15. Performance Review — Tenant Portal Load Waterfall (fixed) + Suggestions

**Already well-optimized (checked, not touched):** fonts (`next/font`),
jsPDF/xlsx (already dynamically imported on-demand, not bundled into
every page), Owner Dashboard/Payments/Approvals (already single
`Promise.all` waves), service worker (deliberately network-first for
financial data — not an oversight).

**Fixed:** `src/app/(tenant)/portal/page.tsx` — the most-visited page
in the app fetched `profiles → tenants → payments → complaints`
fully sequentially, even though neither pair depends on the other.
Grouped into two `Promise.all` waves, cutting 5 sequential round-trips
down to 3. Pure refactor, no behavior change.

**Also fixed:** `src/app/(admin)/admin/page.tsx` — owners list fetch
didn't need to wait for the admin's own profile fetch to finish first;
parallelized the same way.

**The 3 suggested items — deliberately NOT implemented:**
1. Realtime updates — a real feature addition (new subscriptions,
   cleanup, risk of duplicate-update bugs), not a safe tweak to bolt on
   unprompted.
2. List virtualization — not needed at the scale this app actually
   runs at (10–50 tenants/property); would add complexity for a
   problem that doesn't exist yet.
3. Splitting the largest page files — the one item that couldn't be
   properly verified without a real build/browser (which this sandbox
   never had access to all session), so it stayed undone rather than
   risking an unverifiable structural change.

---

## 16. Visual Refresh — Flutter/Material-3-style Soft Rounded Look (app-wide)

**What:** Rounder corners + softer, diffuse shadows across the entire
app (Owner + Tenant + Admin + QR-join), done by editing design tokens
in exactly 2 files (`tailwind.config.ts`, `src/app/globals.css`) — not
by touching individual pages, since every card/button/modal was
already wired to a centralized token system rather than hardcoded
values.

**Explicitly preserved:** Bottom navigation/tabs — verified both
`BottomNav.tsx` files directly; the active-tab pill/badge already used
the untouched `-full` radius key, so tab shape and behavior are
pixel-identical to before.

**Not changed:** layout, spacing, colors, icons, page structure — only
radius + shadow tokens.

---

## 17. Performance — Memoize Ledger Calculations

**Problem:** The ledger functions added earlier this session
(`getRentOutstandingSummary`) ran directly in the render body on 2
pages — the Tenant Portal (50+ pieces of state, so nearly any
interaction re-ran the full month-by-month ledger walk from scratch)
and the Owner Payments page (looped the same expensive computation
over *every tenant* on every re-render). Not a correctness bug —
shows up as UI jank/lag, not wrong numbers.

**Fix:** Wrapped both in `useMemo`, keyed to the actual underlying
state so it only recomputes when data actually changes, not on every
unrelated re-render (typing, opening a modal, switching tabs).

**Also checked, already clean:** `PropertyContext` (properties fetched
once per session, not per page — confirmed via the layout structure),
no leftover `console.log` debug statements anywhere.

---

## 18. Performance — Supabase Client Singleton (biggest single fix in this thread)

**Problem:** `createClient()` in `src/lib/supabase/client.ts` built a
brand-new Supabase browser client on every single call — 25+ call
sites across the app, many inside handlers that fire on every user
interaction. Real, non-free construction cost, repeated constantly.

**The trap checked before caching it:** a naive unconditional singleton
would have kept serving the *mock* Explore-Mode client even after a
user exited Explore Mode — `exitExploreMode()` does a client-side
`router.push()`, not a full reload, so the cached module state
survives that transition.

**Fix:** Cached per explore-mode state — reuses one client in the
common case, correctly builds a new one only when the mode actually
switches. Matches Supabase's own recommended usage pattern (one
long-lived client tracking its own auth state, not reconstructed per
call). Left the *server*-side client untouched — that one must stay
fresh per-request.

**Files:** `src/lib/supabase/client.ts`

---

## 19. UX — Friendly Error Messages (fixes the pattern behind the earlier screenshot bug)

**Problem:** 52 places across 14 files showed raw `error.message`
directly to the user — the exact class of bug behind the "Cannot
coerce the result to a single JSON object" screenshot from earlier in
this session. That specific cause is fixed, but the pattern was still
live everywhere: any future network blip, RLS gap, or constraint
violation would show cryptic PostgREST/Postgres text to a non-technical
tenant or owner.

**Fix:** New `friendlyErrorMessage(error)` in `src/lib/utils/index.ts` —
intercepts known cryptic technical error signatures and returns plain
language, while passing through this app's own already-friendly custom
errors (`"This payment has already been decided"`, etc.) completely
unchanged. Replaced all 52 call sites across 14 files.

**Files:** `src/lib/utils/index.ts` + 14 page files (admin, login,
approvals, complaints, dashboard, expenses, inbox, messages, notices,
payments, rooms, settings, tenants, tenant portal).

---

## FULL FILE LIST (everything touched this session)

**New files:**
- `supabase/39_production_approval_fixes.sql`
- `supabase/40_fix_tenant_onboarding_self_update.sql`
- `src/lib/apk/useApkDownloadGate.ts`

**Modified files:**
- `src/lib/utils/index.ts`
- `src/lib/supabase/queries.ts`
- `src/types/index.ts`
- `src/app/(tenant)/portal/page.tsx`
- `src/app/(owner)/dashboard/page.tsx`
- `src/app/(owner)/payments/page.tsx`
- `src/app/(owner)/tenants/page.tsx`
- `src/app/(owner)/approvals/page.tsx`
- `src/app/(owner)/reports/income/page.tsx`
- `src/components/tenant/OnboardingWizard.tsx`
- `src/app/(auth)/join/[slug]/page.tsx`
- `public/app-version.json`
- `src/app/(tenant)/portal/page.tsx` (also: initial-load Promise.all parallelization — see §15)
- `src/app/(admin)/admin/page.tsx` (same parallelization fix — see §15)
- `tailwind.config.ts` (Flutter/Material-3 rounded+soft visual refresh — see §16)
- `src/app/globals.css` (same — base `--radius` variable)
- `src/app/(tenant)/portal/page.tsx` (also: memoized ledger calc — see §17)
- `src/app/(owner)/payments/page.tsx` (also: memoized ledger calc — see §17)
- `src/lib/supabase/client.ts` (Supabase client singleton — see §18)
- 14 page files + `src/lib/utils/index.ts` (friendly error messages — see §19: admin, login, approvals, complaints, dashboard, expenses, inbox, messages, notices, payments, rooms, settings, tenants, tenant portal)

**No UI/UX was redesigned anywhere** — every change was a targeted
edit preserving existing layout, colors, components, and (where your
Main file had newer features than my starting point — the WhatsApp
auto-invite flow and the "Experience Pack" seasonal banner system)
those were explicitly detected and left untouched.

---

## WHAT'S STILL UNVERIFIED (be honest with your other session about this)

No network/build access existed in this sandbox at any point this
session:
- `npm run build` / `npx tsc --noEmit` was never run — every change
  was verified by static tracing (grep, brace/paren balance, manual
  logic walkthroughs), not a real compile.
- No live Supabase instance, no real Android device — RLS policies and
  the APK download gate were verified by reading the policy/trigger
  logic and running the calculation functions standalone in Node, not
  against a live app.

**Before treating any of this as done: run `npm run build`, apply the
two migrations to a real Supabase project, and test onboarding +
move-out + the APK gate on an actual Android device.**
