# PROJECT_STATE.md

_Last updated: Premium UI/UX Upgrade — Phase 8 (Final QA Pass) — roadmap complete_

## Overview

PG Management SaaS — Next.js 15 + TypeScript + Supabase, multi-tenant (Admin / Owner / Tenant). This document reflects the merged state of **all four phases**: Phase 3 (Tenant Features), Phase 4 (Premium Dashboards), Phase 5 (Reports & Operations), and Phase 6 (Final Product Polish) — developed in two parallel tracks and merged into one base by this pass.

### Premium UI/UX Upgrade — Phase 8 (latest) — Final QA, roadmap complete
Full regression sweep across all 25 files touched in Phases 1–7: zero
brace/paren mismatches, zero invalid Tailwind classes, zero unused
imports. Accessibility pass on every new interactive element. Found
and fixed one last concrete issue: the tenant portal's sidebar said
"RentFlow" while the rest of the app says "Rentivo" — fixed, confirmed
no other instances anywhere. Two items intentionally left as open
decisions rather than resolved unilaterally: pull-to-refresh (Phase 7 —
conflicts with a deliberate existing `overscroll-behavior-y: none`) and
whether to remove the now-redundant mobile hamburger menu now that both
portals have a "More" tab covering the same ground (Phase 8). See
CHANGELOG.md for full detail on both.

**This closes the original 8-phase roadmap** (`RENTIVO_PHASE0_ROADMAP.md`).
Summary of what changed across all 8 phases:
1. System-only theming, no manual toggle, native status-bar fix (Phase 1)
2. Owner/Tenant bottom nav restructured to the required 5-item sets + "More" sheets (Phase 2)
3. Tenant Home/Payments loading skeleton + empty states (Phase 3)
4. Tenant remaining-tab empty states (Phase 4)
5. Owner primary-4-screens audit — Approvals de-duplicated (Phase 5)
6. Owner remaining-screens audit — 6 more pages de-duplicated (Phase 6)
7. Touch feedback on 8 tenant CTAs; error/pull-to-refresh audited (Phase 7)
8. Final regression + accessibility pass; branding fix (Phase 8)

Business logic, APIs, database, auth, permissions, calculations, and
routing were not touched at any phase — every change was UI/UX only,
as required throughout.

### Premium UI/UX Upgrade — Phase 7
Cross-cutting audit: fixed 8 tenant portal primary CTAs (Pay Rent Now,
bill Pay Now, and all 6 modal Submit buttons) that had `hover:` states
only — invisible on touch devices — adding matching `active:` tap
feedback. Confirmed Owner's shared `OwnerButton` already handles this
everywhere it's used. Confirmed error-state handling (toast.error +
deliberate silent-fail-to-empty for background reads) is a real,
consistent, already-correct architecture — left untouched as a
functional pattern, not a styling gap. Investigated pull-to-refresh and
found it's deliberately disabled app-wide (`overscroll-behavior-y:
none` in globals.css, with a comment explaining why) — flagged as a
decision for the person rather than silently implemented or skipped.
See CHANGELOG.md.

### Premium UI/UX Upgrade — Phase 6
Extended Phase 5's audit to the remaining 18 owner pages. Found 10 that
predate the `owner-*` token migration (Reports, Tenant Cards, Visitors,
Parcels, Waiting List, Room Change, Backup, Restore, Archive,
Messages). Fixed the Approvals-style bare/duplicated empty-state
markup in 6 of them (Tenant Cards, Visitors, Parcels, Waiting List,
Room Change, Archive) by swapping in the shared `OwnerEmptyState`
component. Left Owner Messages' two compact inline empty states as-is
(right call for a narrow chat UI, not a duplication problem), and
found nothing to fix in Reports/Backup/Settings. Full token migration
of these 10 pages' remaining styling intentionally deferred — see
CHANGELOG.md for the reasoning, same as the Approvals deferral in
Phase 5.

### Premium UI/UX Upgrade — Phase 5
Audited the 4 primary owner screens (Dashboard, Payments, Tenants,
Approvals) for the tenant-side Phase 3/4 pattern (bare/duplicated empty
states). Dashboard, Payments, and Tenants were already clean — all
already use the shared `OwnerEmptyState` component. Approvals was the
one outlier: it predates the `owner-*` token migration and had 7
hand-copied empty-state blocks with the message hardcoded 7 times over.
Replaced all 7 with `OwnerEmptyState`. Rest of Approvals' styling
(still plain Tailwind, not `owner-*` tokens) intentionally left as a
separate, larger future candidate — it renders correctly today via the
app's existing dark-mode CSS override system. See CHANGELOG.md.

### Premium UI/UX Upgrade — Phase 4
Completed the Empty-States pass across the tenant portal: Tenancy
(Leave Requests), Maintenance, Requests, Messages, and Notices tabs all
got the same icon+heading treatment Phase 3 introduced for Home/
Payments. Documents and Support tabs checked and confirmed to have no
dynamic empty-list case, so nothing needed there. See CHANGELOG.md.
Owner-side screens (Dashboard, Payments, Tenants, Approvals, and the
rest reachable from the new "More" sheet) haven't had this same pass
yet — candidate for the next phase alongside the roadmap's Phase 5/6
(Owner screens, cross-cutting motion/states, final QA).

### Premium UI/UX Upgrade — Phase 3
Tenant Home tab and payment screens: replaced the bare loading spinner
with a layout-shaped skeleton screen (Tailwind `animate-pulse`, no new
dependency), and gave 3 bare-text empty states (Payment History card,
Move-Out Requests, full Payment History tab) an icon+message treatment.
Assessed the Home tab's existing hero/stat/quick-action cards first and
found them already close to the premium bar from earlier phases, so
intentionally didn't re-do work that didn't need it — see CHANGELOG.md
for the full "why" and one self-caught bug (an invalid `w-4.5` class,
fixed before this phase was called done). Remaining tenant tabs still
need the same Loading/Empty-state pass — planned for Phase 4.

### Premium UI/UX Upgrade — Phase 2
Navigation restructure. Owner bottom nav is now Dashboard / Payments /
Tenants / Approvals / More; Tenant bottom nav is now Home / Payments /
Requests / Notices / More. "More" on both sides opens a bottom sheet
(not a new page or route) listing everything else, reusing each
portal's existing nav data (`ownerNav.ts` for Owner, `navItems` filtered
into `moreNavItems` for Tenant) and existing tab/route logic — no
duplicate pages, no new business logic. Both bottom nav bars gained a
premium native-Android treatment: top active-tab indicator, animated
pill + icon pop, CSS-only ripple, 52px touch targets. Full detail in
CHANGELOG.md.

### Premium UI/UX Upgrade — Phase 1
UI/UX-only initiative (no business logic, API, database, auth, permission,
calculation, or routing changes at any phase — enforced by explicit
requirement). Phase 1 scope: removed the manual Light/Dark/System theme
toggle everywhere it existed (Owner Topbar, Owner Settings, Tenant Portal
header) and made theme resolution follow the device's `prefers-color-scheme`
exclusively, with live updates if the OS theme changes mid-session. Also
fixed a pre-existing bug where the native Android/iOS status bar color
never actually tracked the app's theme. Full detail in CHANGELOG.md.
Remaining phases (nav restructure, tenant/owner screen restyling, shared
states/motion, final QA) are tracked in `RENTIVO_PHASE0_ROADMAP.md` and
proceed one at a time with explicit approval between each.

**Known carry-forward**: the polished `components/tenant/ui/*` kit
referenced below is still not wired into the live Tenant Portal page — it
remains ad-hoc-styled Tailwind with its own local dark-mode state (now
system-driven). Adopting the kit there is planned for the tenant screen
phases of the UI upgrade, not done in Phase 1.

### Production Stability Sprint
- **Dark Theme completed application-wide** — the one Critical issue from the Final Production Audit. Implemented via a comprehensive CSS override system in `globals.css` (not per-page edits), covering every literal color utility class actually used across the app. Tenant Portal gained its own dark-mode toggle (it had none before). See CHANGELOG.md for full detail.
- Production build verification re-run: zero broken imports, zero brace mismatches, valid JSON — no build/TypeScript/routing issues found to fix.
- Code quality: assessed for safe duplication reduction; none identified beyond what the prior audit already cleaned up, given the "no large refactors" constraint.

### Phase 7 — Tenant UI Polish (T1–T8) + Owner UI Polish (O1–O12) [Partially Merged]
- **Owner side: fully merged.** New design system (`components/owner/ui`), `OwnerThemeProvider` (dark/light/system, persisted, keeps the global `.dark` class in sync for backward compatibility), redesigned Dashboard/Sidebar/Topbar/Rooms/Tenants/Payments/Expenses/Complaints/Notices/Settings, plus 3 new pages (Properties, Documents, Notifications). All of Phase 3's tenant-request integrations that lived in these pages (Move-Out Checklist, itemized Deposit Deductions, leave/extension-aware rent calculations) were re-integrated during the merge — see MERGE_NOTES.md for exactly what was ported where.
- **Tenant side: infrastructure merged, page redesign NOT applied.** `components/tenant/ui` and `tenant-theme.css` are present in the codebase, but the actual Tenant Portal page still runs the pre-Phase-7 version (with all of Phase 3's request-management UI and the Stability Sprint's dark-mode toggle intact). Phase 7's redesigned tenant portal has zero Phase 3 functionality (confirmed: built on the same pre-Phase-3 baseline as the rest of Phase 7) — merging it in as-is would have been a functional regression, not an upgrade. **This is the primary remaining Phase 7 work**, tracked below.
- Reports kept on Phase 5's system (hub + real Income/Expense/P&L sub-pages) rather than Phase 7's redesign, which is a restyle of the original placeholder reports page — Phase 5's version is functionally more complete.

## Completed Features

### Phase 1 & 2 (pre-existing baseline)
Professional Documents (Agreement/Receipt PDFs), Rent & Deposit management. See CHANGELOG.md for full history.

### Phase 3 — Tenant Features (3.1–3.7)
Tenant-initiated request system, one consistent pattern reused across every type (own table, matching RLS shape, owner Approvals tab, push notification both directions):
- **3.1 Temporary Leave Request** — date-range leave, owner approve/reject, tenant history view
- **3.2 Smart Rent Adjustment** — approved leave prorates that month's rent via one shared utility (`calculateLeaveRentAdjustment`), used consistently across tenant portal, owner dashboard, and owner payments list
- **3.3 Rent Extension Request** — tenant requests more time to pay; approved due-date shift feeds late-fee calculation and an "Extended to …" badge
- **3.4 Move-Out Request + Checklist** — tenant-initiated move-out reusing the existing owner "give notice" flow, plus an owner-managed checklist visible read-only to the tenant
- **3.5 Deposit Settlement** — itemized deduction line items (`tenants.deposit_deduction_items`), auto-calculated refund
- **3.6 Agreement Renewal + Expiry Reminder** — revived the Phase 1 `agreements` table/queries (built but never wired into UI) with one-click renewal
- **3.7 Unified Request History** — single "My Requests" tab merging leave/extension/move-out/maintenance

New tables: `leave_requests`, `rent_extension_requests`, `move_out_requests`, `move_out_checklists`. New column: `tenants.deposit_deduction_items`.

### Phase 4 — Premium Dashboards (4.1–4.6)
- **4.1 KPI Cards** — trend indicators, Collection Rate, Avg Rent/Bed (raw sums aggregated first, percentages derived after)
- **4.2 Tenant Quick Actions** — one-tap row wired to existing Phase 3 handlers
- **4.3 Occupancy Analytics** — 6-month trend + by-sharing-type breakdown
- **4.4 Income vs Expense** — Net Profit headline, previously-uncalculated Profit series now rendered
- **4.5 Activity Timeline + Smart Alerts** — now covers every property + every Phase 3 request type; "Needs Your Attention" panel
- **4.6 Optimization** — deduplicated redundant sequential fetches into one parallel batch

### Phase 5 — Reports & Operations (5.1–5.15)
- **5.1–5.4 Reports Dashboard, Income/Expense/P&L Reports** — hub + 3 dedicated report pages, Excel export
- **5.5 Activity Logs** — synthesized timeline from existing timestamps (no new audit table)
- **5.6 QR Tenant Card** — downloadable ID-card PDF with verification QR
- **5.7 Global Search** — wired up a previously-inert Topbar search input
- **5.8–5.10 Visitor Management, Parcel Management, Waiting List** — new `visitors`/`parcels`/`waiting_list` tables
- **5.11 Room Change Workflow** — room/bed only, never touches rent/deposit; `room_changes` audit log
- **5.12–5.14 Manual Backup, Automatic Backup, Backup Restore** — JSON export (manual + scheduled via Vercel Cron), merge-only restore
- **5.15 Archive & Restore** — soft-archive for Visitors/Parcels/Waiting List

### Phase 6 — Final Product Polish (6.1–6.12)
PWA audit (fixed `start_url`, offline fallback), push notification audit (disable toggle, subscription-rotation handling), offline action queue (Visitor check-in + Parcel logging), `loading.tsx`/`error.tsx` at every route group, lazy-loaded heavy libraries (`xlsx`/`jspdf`/`qrcode`), 4 query-justified database indexes, mobile UX fixes (iOS zoom, safe-area, tap feedback), accessibility improvements (skip-link, ARIA labels/roles), **security fix** (unauthenticated `/api/push/send` — see below), production cleanup (`.gitignore`, `.eslintrc.json`), and a final cross-reference audit.

### Production Audits (both tracks) + This Merge
- Both the Phase 5/6 track and this merge independently found and fixed: 3 competing "09" bills migrations (only `utility_bills` is live — the other two marked `.DEPRECATED.sql`), 10 unused npm packages, and orphaned dead-code components.
- **This merge additionally resolved**: a migration-number collision (Phase 3/4's 18–21 vs. Phase 5's 18–21 — Phase 5's renumbered to 22–28), and re-applied the `/api/push/send` security fix to the Phase 3/4 base, which still had the unpatched, unauthenticated version.

## Folder Structure (merged)

```
src/
  app/
    (owner)/
      dashboard/, rooms/, tenants/, payments/, approvals/, messages/,
      complaints/, expenses/, notices/, settings/          [Phase 1-4]
      reports/{page,income,expenses,profit-loss}/          [Phase 5, replaces the old placeholder]
      visitors/, parcels/, waiting-list/, room-change/,
      tenant-cards/, backup/, restore/, archive/            [Phase 5]
      loading.tsx, error.tsx                                [Phase 6]
    (tenant)/portal/                                        [Phase 3, +1 accessibility attribute from Phase 6]
    (admin)/, (auth)/                                       [+ loading.tsx, error.tsx from Phase 6]
    api/
      push/{send,resubscribe,vapid-public-key}/route.ts    [send = Phase 1/2 + Phase 6 security fix; other two = Phase 6]
      cron/automatic-backup/route.ts                        [Phase 5]
    error.tsx, global-error.tsx, not-found.tsx, loading.tsx [Phase 6]
  components/shared/  [Sidebar/Topbar = Phase 5/6 versions, verified supersets; all others either
                        identical between tracks or exclusively one track's addition]
  lib/
    utils/index.ts — Phase 3/4's version (superset, includes leave/move-out helpers)
    supabase/queries.ts — merged: 58 shared + 16 (Phase 3/4) + 24 (Phase 5/6) functions
    pdf.ts, push.ts, offlineQueue.ts — Phase 5/6 versions (confirmed supersets)
  types/index.ts — merged: shared baseline + Phase 3/4's 12 types + Phase 5/6's 11 types
supabase/
  01-17: shared baseline
  18-21: Phase 3/4 (leave_requests, rent_extension_requests, move_out_requests, deposit_deduction_items)
  22-28: Phase 5/6, renumbered from their original 18-24 to resolve the collision
  09_electricity_bills.DEPRECATED.sql, 09_utility_bills.DEPRECATED.sql
```

## Database Changes (full merged set)

Phase 3/4 tables: `leave_requests`, `rent_extension_requests`, `move_out_requests`, `move_out_checklists`. Column: `tenants.deposit_deduction_items`.
Phase 5/6 tables: `visitors`, `parcels`, `waiting_list`, `room_changes`, `backup_settings`, `backup_runs`. Columns: `archived_at` on `visitors`/`parcels`/`waiting_list`. Storage bucket: `automatic-backups` (private).
Indexes: see `28_database_optimization.sql`.

## Pending Work / Known Limitations

- **Tenant Portal redesign not yet applied** (see Phase 7 section above) — the highest-priority remaining item. Needs Phase 3's request-management UI (leave/rent-extension/move-out/deposit-settlement/agreement-renewal) re-integrated into Phase 7's `tenant/ui`-based redesign, the same way it was done for the Owner side's Tenants/Payments/Settings pages during this merge.
- **Dashboard's 3 newest KPI displays** (revenue trend %, collection rate %, avg rent/bed) aren't rendered by Phase 7's redesigned Dashboard UI — the backend still computes them (`getDashboardStats()`, unchanged), just not surfaced in this particular redesign yet.
- **Visitors, Parcels, Waiting List, Room Change, Tenant Cards, Backup, Restore, Archive** — Phase 5's operational pages — are not yet on the Phase 7 design system (still their original styling, kept dark-theme-compatible via the Stability Sprint's CSS overrides). Same for Approvals and Messages, which Phase 7 itself deliberately left unredesigned.
- **Dark Theme**: complete for all pages/components/forms/tables/modals/toasts, on both the pre-Phase-7 CSS-override system (still active for unredesigned pages) and Phase 7's new token-based system (for redesigned pages) — verified compatible, not conflicting. One disclosed, minor exception carried over: recharts axis/grid colors aren't theme-aware (inline SVG props, not CSS-reachable).
- Carried over from Phase 5/6: `Promise.all`-across-properties fetching (not batched `.in()`), partial accessibility label-association coverage, offline queue covers only 2 flows, no CSP header.
- Could not run `npm install`/`npm run build`/`npm run lint` in this environment across any pass of this entire engagement (no network access) — static analysis (import cross-referencing, brace balance, JSON validation) was as thorough as possible without a real build; still the recommended next step, and the one most likely to catch anything a large multi-file merge like this one could have missed.
- The two `.DEPRECATED.sql` files are kept for history, not deleted.
