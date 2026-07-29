# MERGE_NOTES.md

_Merge: Phase 3/4 (Audited Release) ← Phase 5/6 (Audited Release)_
_Updated: Production Stability Sprint (Dark Theme + build verification)_
_Updated: Phase 7 merge (Tenant UI Polish T1–T8 + Owner UI Polish O1–O12)_

## Phase 7 merge — approach

Phase 7 was built on a **pre-Phase-3/4/5/6 base** (verified: its `queries.ts`/`types/index.ts` contain zero functions or types beyond the original 58-function/pre-existing-type baseline — a pure frontend redesign, no backend changes at all). This made the merge tractable but required checking, page by page, whether the current project's version of each page Phase 7 touched had any Phase 3/4/5 backend integration that Phase 7's older base wouldn't know about — and if so, porting it forward rather than losing it.

## Files Modified

| File | What changed | How it was verified safe |
|---|---|---|
| `tailwind.config.ts` | Took Phase 7's version wholesale | Diffed first — 100% additive (new `owner-*`/`tenant-*` namespaces), zero lines removed from the current config |
| `src/components/shared/Sidebar.tsx` | Phase 7's redesign + all 9 of Phase 5's nav items + `pb-safe` mobile fix added back | Phase 7's nav array had 13 items (missing all of Phase 5's operational pages, which predate it); added them back with matching icons |
| `src/components/shared/Topbar.tsx` | Phase 7's redesign + Global Search (5.7) results dropdown + `OfflineQueueBadge` (6.3) added back | Phase 7's search box was cosmetic-only (state existed, no results query) — confirmed by reading the component before assuming it worked |
| `src/components/shared/OwnerShell.tsx` | Took Phase 7's version, restored one attribute: `id="main-content"` | Diffed first; this was the only difference from taking it wholesale — needed by the Stability Sprint's skip-link, which postdates Phase 7 |
| `src/app/(owner)/settings/page.tsx` | Phase 7's redesign + Push Notifications toggle (6.2) restored as its own card | Diffed imports first — Phase 7's settings page had no push-notification imports at all |
| `src/app/(owner)/tenants/page.tsx` | Phase 7's redesign + Move-Out Checklist (3.4) + itemized Deposit Deductions (3.5) restored | Confirmed via import diff that Phase 7's version was missing `getMoveOutChecklist`/`startMoveOutChecklist`/`updateMoveOutChecklist`; grafted the modal, state, and handlers back in |
| `src/app/(owner)/payments/page.tsx` | Phase 7's redesign + leave/extension-aware effective-rent calculation (3.2/3.3) restored | This one was treated as a correctness fix, not optional polish — without it, the redesigned page would show inflated due amounts for any tenant with an approved leave or rent extension |
| `src/app/(owner)/layout.tsx` | Added one import line (`./owner-theme.css`) | Diffed first — confirmed this was the only difference |

## Files taken wholesale from Phase 7 (redesigns with zero backend divergence — verified via import diff before copying, not assumed)

`rooms/page.tsx`, `expenses/page.tsx`, `complaints/page.tsx`, `notices/page.tsx`, `dashboard/page.tsx`

Each confirmed to only call functions that already existed unchanged in the shared 58-function baseline — no Phase 3/4/5 addition anywhere in these specific files to lose.

## Files Added (new in Phase 7, present in neither prior track)

- `src/components/owner/ui/*` (14 components + index.ts + design doc)
- `src/components/tenant/ui/*` (13 components + index.ts + design doc)
- `src/components/shared/AddPropertyModal.tsx`
- `src/app/(owner)/owner-theme.css`, `src/app/(tenant)/tenant-theme.css`
- `src/app/(owner)/properties/`, `documents/`, `notifications/`

## Deliberately NOT merged

- **`src/app/(tenant)/portal/page.tsx`** — kept the current version (Phase 3 features + Stability Sprint dark-mode toggle intact) rather than Phase 7's redesign, which has zero Phase 3 functionality. Re-integrating ~1200 lines of request-management UI into a different visual framework without a build/test environment to verify against was judged too large and too risky to do safely within this pass. **This is the single largest piece of remaining Phase 7 work** — flagged explicitly rather than either rushed or silently dropped.
- **`src/app/(tenant)/layout.tsx`** — not adopted. It wraps children in `TenantThemeProvider`, which deliberately does *not* toggle the global `.dark` class (by design, to avoid clashing with pages using literal Tailwind `dark:` variants). Since the current Tenant Portal page relies on exactly that `.dark`-class mechanism for its own dark-mode toggle, adopting this layout without also redesigning the page itself would have silently broken tenant-side dark mode for no benefit.
- **`src/app/(owner)/reports/page.tsx`** — kept Phase 5's Reports Dashboard (real Income/Expense/P&L sub-pages) over Phase 7's redesign, which — confirmed by inspection — restyles the *original placeholder* reports page, not Phase 5's more complete system. Taking it would have been a regression, and the task's own rule is not to overwrite newer implementations.
- **Visitors, Parcels, Waiting List, Room Change, Tenant Cards, Backup, Restore, Archive, Approvals, Messages** — Phase 7 never touched any of these (confirmed for Approvals/Messages by Phase 7's own changelog; confirmed for the rest by their complete absence from Phase 7's `queries.ts`/route folders, since they postdate Phase 7's base). Left as-is, still dark-theme-compatible via the Stability Sprint's CSS overrides.
- **Phase 4's 3 newest KPI displays** (trend %, collection rate %, avg rent/bed) — not grafted into Phase 7's redesigned Dashboard. The backend still computes them; Phase 7's dashboard is a cohesive, complete redesign, and adding 3 more stat tiles without visual/layout testing risked a worse result than leaving it as shipped.

## Bug found and fixed during this merge

Initial `cp -r` of `components/owner`/`components/tenant` nested one level too deep (`components/owner/owner/ui/...`) because those directories already existed as empty placeholders from an earlier audit finding. Caught immediately by the post-merge import-resolution sweep (every `@/components/owner/ui` import would have failed to resolve), fixed, and re-verified clean before proceeding.

## Merge Risks

**Low-to-moderate**, concentrated entirely in one place: the Tenant Portal gap. Everything else in this merge was either a verified-zero-risk wholesale copy or a surgical port where the exact backend functions needed were confirmed present and the exact call sites were located before writing any code. The one thing that could not be fully verified without a real build is whether every JSX prop passed to the new `owner/ui` components (`OwnerButton`, `OwnerCard`, etc.) exactly matches their expected prop types — brace-balance and import-resolution checks catch structural breakage but not type-level mismatches, which only `tsc` can catch.

## Merge Recommendation

**Ready to continue with, conditional on:**
1. A real `npm install && npm run build` — the single most valuable next step given the scale of this merge, and the one check unavailable in every environment this whole engagement has run in.
2. Prioritizing the Tenant Portal redesign as the next piece of Phase 7 work, using the same page-by-page porting approach documented here for the Owner side.
3. Running migrations `18` through `28` in order (skipping the two `.DEPRECATED.sql` files) if not already applied, and setting `CRON_SECRET`.


## Production Stability Sprint — files touched after the merge

| File | Change |
|---|---|
| `src/app/globals.css` | Added a ~130-line `.dark`-scoped CSS override block covering every literal color utility class used across the app (backgrounds, text, borders, badge tints, form fields, tables, Sonner toasts) — completes the application-wide Dark Theme the Final Production Audit flagged as the one Critical issue. No component files touched; this is pure CSS layered on top of Tailwind's output. |
| `src/app/(tenant)/portal/page.tsx` | Added `darkMode` state, a toggle button in the header, and a `.dark` wrapper div — surgical addition (~10 lines) to the existing 1869-line file. The Tenant Portal had no dark-mode capability at all before this. |

No other files were touched during the sprint. See CHANGELOG.md for the full technical rationale (palette choices, what was and wasn't covered, why).

## Merge approach

The uploaded Phase 3/4 project was used as the base (per instructions). Every file was compared against the completed Phase 5/6 implementation before any change was made — see the "Analysis" column below. No file was overwritten without first confirming what would be lost by doing so.

## Files Modified

| File | What changed | How it was verified safe |
|---|---|---|
| `src/lib/supabase/queries.ts` | Appended Phase 5/6's 24 functions after Phase 3/4's existing content; merged the top `import type {...} from '@/types'` line to include both sides' `Input` types | Diffed function name sets — zero collisions (58 shared, 16 Phase 3/4-only, 24 Phase 5/6-only) |
| `src/types/index.ts` | Appended Phase 5/6's 11 types after Phase 3/4's existing content | Same zero-collision check; separately confirmed Phase 3/4's `Tenant.deposit_deduction_items` field and `DashboardStats`'s new KPI fields survived untouched |
| `package.json` | Removed 9 unused `@radix-ui/*` packages + `class-variance-authority` | Re-confirmed zero usage of each in this merged project's `src/` (not assumed from the earlier audit) |
| `.env.local.example` | Appended Phase 5/6's `CRON_SECRET` section after Phase 3/4's existing content | Preserved Phase 3/4's corrected Super Admin comment rather than overwriting it with Phase 5/6's less-accurate original wording |
| `(tenant)/portal/page.tsx` | One attribute added: `id="main-content"` on the `<main>` tag | Diffed full files first — Phase 3/4's version is 1869 lines (their whole Tenant Features build); confirmed this was the only difference before touching anything |
| `(owner)/reports/page.tsx` | Replaced wholesale with Phase 5's Reports Dashboard hub | Confirmed Phase 3/4's copy was byte-for-byte the original untouched placeholder first |
| `src/app/api/push/send/route.ts` | Replaced wholesale with Phase 6's auth-fixed version | Confirmed Phase 3/4's copy was the pre-fix, unauthenticated version — same vulnerability the Phase 5/6 audit found, now fixed here too |
| `supabase/09_electricity_bills.sql` to `.DEPRECATED.sql` | Same dead-migration fix as the Phase 5/6 audit | Re-confirmed via this project's own `queries.ts` that `utility_bills` is the only one actually queried |
| `supabase/09_utility_bills.sql` to `.DEPRECATED.sql` | Same as above | Same |
| `supabase/18-24_*.sql` (Phase 5/6's) renumbered to `22-28` | Filename only, zero content changes | Phase 3/4's `18-21` already occupied those numbers with entirely different tables — confirmed zero table-name collisions before renumbering, only file-number collisions |
| `CHANGELOG.md` | New merge entry prepended, then Phase 5/6's full history, then Phase 3/4's full existing file (unmodified) | Structural check: all headers still present and in order after assembly |

## Files taken wholesale from Phase 5/6 (Phase 3/4's copy confirmed identical to Phase 5/6's starting point, so nothing of Phase 3/4's was lost)

`Sidebar.tsx`, `Topbar.tsx`, `push.ts`, `pdf.ts`, `layout.tsx`, `globals.css`, `next.config.ts`, `manifest.json`, `sw.js`, `vercel.json`, `settings/page.tsx`, `OwnerShell.tsx`

Each of these was diffed line-by-line first; in every case, Phase 3/4's version differed from Phase 5/6's version only by the absence of Phase 5/6's own additions — meaning Phase 3/4 never touched these files at all.

## Files Added (new in this merge, present in neither track before)

- `.eslintrc.json`, `.gitignore` (from the Phase 5/6 Production Audit)
- `src/app/(owner)/{visitors,parcels,waiting-list,room-change,tenant-cards,backup,restore,archive}/` — entire Phase 5 route folders
- `src/app/(owner)/reports/{income,expenses,profit-loss}/` — Phase 5 report sub-pages
- `src/app/{loading,error,global-error,not-found}.tsx` + one `loading.tsx`/`error.tsx` pair per route group — Phase 6
- `src/components/shared/{PageLoader,ErrorFallback,OfflineQueueBadge}.tsx`, `src/lib/offlineQueue.ts` — Phase 6
- `src/app/api/push/{resubscribe,vapid-public-key}/route.ts`, `src/app/api/cron/automatic-backup/route.ts` — Phase 5/6
- `public/offline.html` — Phase 6

## Files Removed

- `src/components/shared/NotificationBell.tsx` — zero importers anywhere in the merged project (re-confirmed, not assumed)

## Merge Risks

**Low.** The two tracks worked in genuinely disjoint territory (confirmed programmatically — zero function/type/table name collisions), which is exactly what the original parallel-development instructions to both tracks were designed to produce. The handful of shared-file conflicts were all either pure appends (safe by construction) or single-file, single-purpose overwrites verified safe by diffing first. The one true "same line changed by both" conflict (`.env.local.example`'s Super Admin comment) was resolved by keeping the more accurate version rather than picking a side arbitrarily.

**The one thing worth a human's attention**: the `/api/push/send` auth fix changes real behavior (an endpoint that used to accept unauthenticated requests now returns 401). If anything outside this codebase calls that URL directly, it will start failing. Checked whether Phase 3/4's leave/rent-extension/move-out approval flows call it directly — they don't; they use the same `sendPushNotification()` client helper as everything else, which goes through the now-fixed route correctly.

## Merge Recommendation

**Ready to become the new base for the Tenant UI merge**, conditional on:
1. Running migrations `18` through `28` in order (skipping the two `.DEPRECATED.sql` files) against the target database.
2. Setting `CRON_SECRET` in the deployment environment.
3. A real `npm install && npm run build && npm run lint` pass — not performed in this environment (no network access), and the single highest-value verification step before this becomes anyone else's base.
