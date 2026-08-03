# Owner Dashboard — Design System (Phase O1)

Foundation only through O1.2 — no pages or Sidebar/Topbar have adopted
these yet (that's O1.3 and O2+). This is the token/typography/component
reference for everything after.

## Namespacing

Same approach as the Tenant Portal's design system, mirrored for the
Owner Dashboard:
- CSS variables: `--owner-*`, scoped to `.owner-shell` in
  `src/app/(owner)/owner-theme.css` (never `:root` or `.dark` globally).
- Tailwind classes: `owner.*` namespace → `bg-owner-surface`,
  `text-owner-fg`, `rounded-owner-xl`, etc.
- Theme state: `OwnerThemeProvider` / `useOwnerTheme()`, own localStorage
  key, independent of the Tenant Portal's theme.

The Owner, Tenant, and Admin/Auth shells never share color/theme state
with each other, by design — each is a fully separate visual scope.

## Why Owner tokens differ slightly from Tenant tokens

Same brand hue family (indigo primary, same status color hues) for visual
consistency across the whole product, but tuned for **desktop information
density** rather than mobile-native card sizing:
- Radius scale is tighter: `owner-xs`(6)→`owner-2xl`(20), vs. the tenant
  scale's `tenant-xs`(8)→`tenant-3xl`(28). Desktop SaaS tables and cards
  read better with smaller corner radii at this density.
- Shadows are more restrained — a data-dense dashboard with many visible
  cards at once needs subtler elevation than a single-card-at-a-time
  mobile screen.
- No dedicated "glow" treatment beyond one `shadow-owner-glow` for the
  rare primary hero card — mobile's glowing CTA pattern doesn't suit a
  desktop table-and-cards layout with many focal points.

## Components (`src/components/owner/ui/`)

| Component | Notes |
|---|---|
| `OwnerButton` | variant: primary/secondary/outline/ghost/destructive/link. size: sm/md/lg/icon. |
| `OwnerIconButton` | Square (not pill — matches desktop toolbar conventions), optional badge. |
| `OwnerCard` (+Header/Title/Description) | variant: default/elevated/interactive/ghost/primary. |
| `OwnerBadge`, `ownerStatusTone(status)` | Status chips; the tone-mapping helper covers tenant/payment/room/complaint/approval status strings already used across the app. |
| `OwnerInput`, `OwnerTextarea`, `OwnerSelect` | Label/error/hint slots, `OwnerSelect` has a custom chevron over a native `<select>` (no new dependency). |
| `OwnerTable` (+Head/Body/Row/HeadCell/Cell/EmptyRow) | `OwnerTableHeadCell` supports optional sort affordance (`sortable`, `sortDirection`, `onSort`) — wire up when a page needs it, no requirement to use it everywhere. |
| `OwnerAvatar` | Photo or initials fallback. |
| `OwnerDivider`, `OwnerSectionHeader`, `OwnerEmptyState` | Layout utilities. |
| ~~`OwnerThemeToggle`~~ | Removed in Premium UI Upgrade Phase 1. Theme now always follows the device's system setting (`OwnerThemeProvider`); no manual override exists. |

Import from the barrel: `import { OwnerButton, OwnerCard, ... } from '@/components/owner/ui'`.

## What's next

- **O1.3**: Sidebar + Topbar redesign — the first phase where any of this
  becomes visible.
- **O2+**: page-by-page migration (Dashboard, Properties, Rooms & Beds,
  Tenants, …), each its own phase per the roadmap.
