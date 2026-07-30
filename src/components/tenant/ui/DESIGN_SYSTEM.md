# Tenant Mobile UI — Design System (Phase T1)

Foundation only — no pages have been redesigned yet. This is the palette,
typography, and primitive component set that Phases T2–T8 will build with.

## Why everything is namespaced `tenant-*`

The Owner Dashboard, Admin panel, and Auth screens already use the
shadcn/ui tokens in `globals.css` (`--background`, `--primary`, `border`,
etc.) and `darkMode: 'class'` on `<html>`. Redefining those globally to
"go dark by default" would silently reskin every other screen in the app —
out of scope, and a real risk to something that already works.

Instead:
- New tokens live under `--tenant-*` in `src/app/(tenant)/tenant-theme.css`,
  scoped to `.tenant-portal` (never `:root` or `.dark`).
- New Tailwind color/radius/shadow keys live under a `tenant` namespace in
  `tailwind.config.ts`, so classes read `bg-tenant-surface`,
  `text-tenant-fg`, `rounded-tenant-2xl`, etc. — never colliding with the
  existing `bg-background`, `rounded-lg`, and so on.
- The theme (dark/light/system) is written as a `data-theme` attribute on
  the `.tenant-portal` wrapper div, not on `<html>` — so it can't interact
  with the existing global dark-mode class at all.

`src/app/(tenant)/layout.tsx` is a new file that wraps the existing
`portal/page.tsx` with `<TenantThemeProvider>`. It doesn't touch the
page's data fetching, auth check, or business logic.

## Color palette

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `tenant-bg` | `#0A0C11`-ish near-black navy | soft off-white | Page background |
| `tenant-surface` | slightly lifted navy | white | Card background |
| `tenant-surface-elevated` | lifted further | white | Modals, sheets |
| `tenant-border` | subtle hairline | light gray | Card/input borders |
| `tenant-fg` | near-white | near-black | Primary text |
| `tenant-muted` | mid gray | mid gray | Secondary text |
| `tenant-primary` | indigo `#5B54ED`-ish | indigo | Buttons, active states, links |
| `tenant-success` / `-subtle` | green | green | Paid, approved, resolved |
| `tenant-warning` / `-subtle` | amber | amber | Pending, in progress |
| `tenant-danger` / `-subtle` | red | red | Due, overdue, rejected |
| `tenant-info` / `-subtle` | blue | blue | Neutral status, partial |
| `tenant-purple` / `-subtle` | violet | violet | Category accent (e.g. visitor/leave icons) |
| `tenant-teal` / `-subtle` | teal | teal | Category accent |

Every `-subtle` token is a low-opacity tint of its base color, meant for
badge/chip backgrounds (`bg-tenant-success/15 text-tenant-success`) rather
than solid fills — solid fills are reserved for one hero element per screen
(the primary CTA, the "Due Today" badge).

## Typography

- **Body / UI text:** Inter (already the app-wide font, unchanged).
- **Display (signature element):** Manrope, loaded only inside the tenant
  layout via `--font-tenant-display` → Tailwind class `font-tenant-display`.
  Use **sparingly** — large rupee amounts, the dashboard greeting, and
  section numerals only. Everything else stays Inter. This is the one
  typographic flourish; don't spread it further.
- Use `.tenant-numeric` (or `font-tenant-display` + tabular nums is baked
  in) on any rupee amount, date, or counter so digits don't jitter as they
  update.

Suggested scale (use directly as Tailwind classes, no new fontSize tokens
were added to keep this simple):

| Role | Classes |
|---|---|
| Display amount | `font-tenant-display font-extrabold text-3xl tenant-numeric` |
| Page title | `text-lg font-bold` |
| Section header | `text-[13px] font-bold` |
| Card title | `text-[15px] font-bold` |
| Body | `text-sm` |
| Caption | `text-xs text-tenant-muted` |
| Overline | `text-[10px] font-semibold uppercase tracking-wide text-tenant-muted-subtle` |

## Spacing & radius

- Use Tailwind's default spacing scale (4px base) for padding/gaps — no
  new spacing tokens were introduced.
- Page gutter: `px-4`. Card gap in a list: `gap-3`.
- Radius scale (native-Android-generous, not the old shadcn 10px default):
  `rounded-tenant-xs` (8) → `sm` (10) → `md` (12) → `lg` (16) → `xl` (20)
  → `2xl` (24, standard card radius) → `3xl` (28, sheets/modals) → `full`
  (pills, avatars, FAB).

## Shadows

Flat box-shadows barely read on a near-black background, so most elevation
is done with a lighter surface color + hairline border instead. Shadows are
reserved for:
- `shadow-tenant-md` / `-lg` — modals and sheets that need to visually
  separate from the page.
- `shadow-tenant-glow` / `-glow-lg` — a soft indigo glow used only on the
  primary CTA button and the FAB, so the one action you're meant to take
  visually stands out. Don't put a glow on more than one element per screen.

## Components (`src/components/tenant/ui/`)

| Component | Notes |
|---|---|
| `Button` | `variant`: primary / secondary / outline / ghost / destructive / link. `size`: sm / md / lg / icon. |
| `IconButton` | Circular, with an optional unread-count `badge`. |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription` | `variant`: default / elevated / interactive / ghost / primary (primary = filled hero card, one per screen). |
| `Badge`, `statusTone(status)` | Pill status chips; `statusTone()` maps existing DB status strings (`approved`, `pending_approval`, `resolved`, …) to a tone automatically. |
| `Input`, `Textarea` | Label / error / hint / left-icon slots built in. |
| `Avatar` | Photo or initials fallback. |
| `TopAppBar` | Sticky, blurred, safe-area aware. `variant`: large (dashboard greeting) / compact (inner pages with a title + back button). |
| `BottomNav` | Fixed tab bar, active pill behind the icon, per-item unread badges. |
| `FAB` | One per screen, floats above the bottom nav automatically. |
| `Divider`, `SectionHeader` | Layout utilities. |
| `ThemeToggle` | Three-way light/dark/system segmented control — fully wired to the engine, ready to drop into Profile & Settings (T7). |
| `TenantThemeProvider`, `useTenantTheme()` | The theme engine itself. |

Import from the barrel: `import { Button, Card, Badge, ... } from '@/components/tenant/ui'`.

## What's next

T2 (Home Dashboard) is the first phase that actually applies these tokens
and primitives to a real screen. Nothing in `portal/page.tsx` has been
touched yet.
