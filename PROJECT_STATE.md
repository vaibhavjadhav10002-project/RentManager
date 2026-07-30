# PROJECT_STATE.md

_Last updated: Merge of Phase 3/4 (Audited Release) + Phase 5/6 (Audited Release)_

## Overview

PG Management SaaS — Next.js 15 + TypeScript + Supabase, multi-tenant (Admin / Owner / Tenant). This document reflects the merged state of **all four phases**: Phase 3 (Tenant Features), Phase 4 (Premium Dashboards), Phase 5 (Reports & Operations), and Phase 6 (Final Product Polish) — developed in two parallel tracks and merged into one base by this pass.

### Production Stability Sprint (latest)
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
