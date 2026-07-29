# MAINTENANCE_GUIDE.md

Ongoing-upkeep reference — what a maintainer should check periodically,
and the conventions to follow so the project stays as consistent as it
is today.

## Conventions to preserve

- **New Supabase migration?** Check `ls supabase/ | sort` for the highest existing number first, prefer additive changes (new nullable columns/tables) over destructive `alter`/`drop`, and update `DATABASE_SCHEMA.md`'s migration order list. (This project has hit and fixed a migration-numbering collision twice in its history — see `RC_AUDIT_REPORT.md` — checking the actual directory listing before naming a new file is the whole fix.)
- **New data access?** Add a function to `src/lib/supabase/queries.ts`; don't call `supabase.from(...)` directly from a page.
- **New owner-facing OR tenant-facing UI component?** Match the existing design system for that side (`src/components/owner/ui/` or `src/components/tenant/ui/`) — these are intentionally separate (see `ARCHITECTURE.md`); don't share a component across both unless it's genuinely identical in both contexts, in which case it belongs in `src/components/shared/`.
- **New interactive element (button/link)?** Confirm it has a visible `focus-visible` state (the shared `Button`/`IconButton` components already do this — extend their `cva` variants rather than writing one-off styles) and a minimum 44px touch target for anything mobile-reachable.
- **New money calculation?** Put it in `src/lib/utils/index.ts` alongside the existing rent/late-fee/advance logic — never duplicate a calculation in both the owner and tenant views.
- **Touching push notifications?** Remember there are two independent delivery paths sharing one table (`push_subscriptions`) — see `SYSTEM_DESIGN.md`'s push flow section before changing anything in `push.ts` or `api/push/send`.

## Periodic checks

- **Quarterly-ish:** re-run an unused-import sweep across `src/` (the audit in `RC_AUDIT_REPORT.md`/`PRODUCTION_POLISH_REPORT.md` found a handful accumulate over time even in an otherwise clean codebase — cheap to catch early).
- **Before any native app store release:** run through `MOBILE_GUIDE.md`'s testing checklist on a real device.
- **After any Supabase Auth or RLS policy change:** log in as each of the three roles and confirm no cross-role/cross-owner data leakage — RLS is the actual security boundary (see `SYSTEM_DESIGN.md`), so a policy typo is a real data-exposure risk, not just a bug.
- **Dependency updates:** `npm outdated` periodically; prioritize `@supabase/*`, `next`, and the `@capacitor/*` packages, since those three surfaces (Supabase API, Next.js, native shell) are where breaking changes are most likely to actually break something in production.

## Where to look first when debugging

| Symptom | Start here |
|---|---|
| Wrong role sees wrong data | RLS policy for that table, then `middleware.ts` |
| A dollar/rent figure looks wrong | The single shared calculation function in `src/lib/utils/index.ts` — check its inputs, not the display code |
| Push not arriving | Confirm which path (web vs native) the recipient's row uses in `push_subscriptions`, then see `SYSTEM_DESIGN.md`'s push flow |
| Something works on web but not in the native app | `src/lib/native/` — check whether the feature has a native branch at all, or needs one |
| Migration won't apply cleanly | Check you're not re-running an already-applied migration, and check for numbering collisions per `DATABASE_SCHEMA.md` |

## Documentation map (read this, then the right doc)
`ARCHITECTURE.md` (map) → `SYSTEM_DESIGN.md` (flows) →
`DATABASE_SCHEMA.md` / `API_DOCUMENTATION.md` (specifics) →
`DEPLOYMENT_GUIDE.md` / `DISASTER_RECOVERY.md` / `BACKUP_RESTORE_GUIDE.md`
(operations) → `ADMIN_MANUAL.md` / `OWNER_MANUAL.md` / `TENANT_MANUAL.md`
(end users) → `MOBILE_GUIDE.md` (mobile specifics) → this file
(ongoing upkeep). `PROJECT_STATE.md` and `CHANGELOG.md` remain the
authoritative phase-by-phase history for "why does this exist."
