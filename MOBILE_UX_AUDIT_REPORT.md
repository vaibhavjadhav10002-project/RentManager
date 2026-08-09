# MOBILE_UX_AUDIT_REPORT.md

## Session 3 — Dashboard redesign, premium bottom nav, final polish pass

Builds on Sessions 1–2 below. Environment note stated upfront, same as
every prior pass: this sandbox has no `npm install`/network access, so
nothing here was verified by literally rendering the app or a real
Android device — every claim below was verified by reading the actual
resulting code/CSS and reasoning through the box model (documented
inline where relevant), not assumed. Real device verification of
everything in this session is the top recommendation below.

### Completed: Mobile Dashboard Redesign (previously intentionally skipped)

**Owner dashboard.** The previous session left the dashboard's 9 stat
cards as a flat, equal-weight 2-column grid on mobile — functional, but
with no hierarchy (a premium app doesn't show 9 numbers with the same
visual weight). Redesigned the **mobile-only** layout:
- A hero card for Monthly Revenue (the single number owners check
  most), given real visual prominence — larger type, gradient
  background, trend indicator — instead of competing equally with 8
  other cards.
- Remaining 8 stats regrouped into two labeled sections ("Needs
  Attention": Pending Rent, Collection Rate, Vacant Beds, Open
  Complaints; "Property Overview": Total Rooms, Total Tenants, Occupied
  Beds, Avg Rent/Bed) — actual information grouping, not just a
  re-ordered flat grid.
- Desktop's original 7-column grid is byte-for-byte unchanged (kept
  under `hidden lg:grid`, the mobile version is `lg:hidden`).

**Tenant dashboard.** Same treatment: a "Next Rent Due" hero card
(amount + due date + status, using data the page already computes —
`totalRentPending`, `nextDueDate`, `daysLeft`, `thisMonthPaid`, no new
logic) replaces 4 equal-weight cards on mobile; Total Rent and Paid
Amount become a smaller secondary pair below it. Desktop's original
4-card grid is unchanged.

**Not done:** a full visual overhaul of the charts/analytics/calendar
sections further down both dashboards (still stack in the original
single-column order on mobile). Given this pass's own constraint
("do not redesign... reuse existing components") and no way to
visually verify a deeper restyle here, the stat-card hierarchy — the
first thing a user sees, and the most concretely "was skipped" item —
was prioritized over restyling every section. Flagged explicitly as a
scope boundary, not silently left incomplete.

### Completed: Premium Bottom Navigation
Both `OwnerBottomNav` and the tenant portal's inline bottom nav now
have:
- **Animated active indicator** — the tinted pill scales in
  (`scale-90`→`scale-100`) rather than just appearing, and the active
  icon "pops" to a slightly larger size, both on a 300ms ease-out
  transition. No animation library added — pure CSS transitions on
  conditional classes.
- **CSS-only tap ripple** — a `before:` pseudo-element per button that
  scales from 0→100% and fades in on `:active`. Not true Material
  ripple (which tracks exact tap coordinates via JS) but a reasonable,
  dependency-free approximation of the same "tap acknowledged" feel.
- **Elevation** — a soft upward shadow (`shadow-[0_-8px_24px_-8px_...]`)
  added to both, on top of the existing blur/hairline border, so the
  bar reads as sitting above the content rather than flush with it.
- Safe-area handling (`native-safe-bottom`/`pb-safe`) and consistent
  spacing were already correct from Session 2 — re-verified, not
  redone.
- **Gesture navigation:** not independently testable without a device,
  but the bar already respects `env(safe-area-inset-bottom)` via the
  existing safe-area classes, which is the correct mechanism for
  clearing Android's gesture nav pill — flagged for real-device
  confirmation rather than assumed correct.

Also added consistent touch feedback (`active:scale-95`) to both
dashboards' Quick Actions tiles, which previously only had `hover:`
effects — meaningless on a touchscreen, a gap this exact audit report
already flagged in Session 1 for `hover:` generally but these specific
tiles' `active:` state had been missed until now.

### Found and fixed: a real unwrapped table
`approvals/page.tsx` has a 3-column table (long labels + address text +
live `<input>` fields per row) with **no `overflow-x-auto` wrapper** —
the only table in the entire app missing one (every other table,
including the shared `owner/ui/Table.tsx` component, already wraps
correctly). Confirmed by checking every `<table>` usage in the
codebase, not assumed. Fixed with the same wrapper pattern used
everywhere else, plus a `min-w-[480px]` so the input fields stay usable
width rather than being squished to fit 360dp.

### Checked, confirmed NOT bugs (verify-before-fix in practice)
Two other `flex gap-2` rows (payment method selector, complaint
priority selector) were checked for the same overflow risk — both use
`flex-1` on their buttons, which distributes width evenly regardless of
screen size and cannot cause page-level horizontal scroll. Left
unchanged; false alarms caught before wasting a fix on something that
wasn't broken.

### Scope boundary: the other ~14 individual pages listed in the brief
Payments, Tenants, Complaints, Maintenance, Visitors, Notice Board,
Settings, Profile, Chat, Requests, Renewals, Move Out, and Analytics
were **not** each individually redesigned this session. What was done:
a targeted, real audit for the specific failure modes named in the
brief (table overflow — found and fixed one real instance, confirmed
the rest are already wrapped; filter-row overflow — checked, confirmed
safe). A full per-page visual redesign of all ~14 remaining screens, at
a level where every one can be honestly claimed "reviewed
individually," is a substantially larger effort than this pass — doing
it credibly needs real device/screenshot verification this environment
cannot provide, and doing it blind risks exactly the kind of regression
the brief's own "preserve everything" section warns against. Named here
explicitly rather than claimed as done.

### Recommendations
1. **Real-device verification is now the single highest-priority next
   step** — specifically the dashboard hero cards' text sizing at
   360dp (the narrowest listed width), the bottom nav's ripple/gesture
   behavior, and the approvals table fix, none of which were rendered
   anywhere during this session.
2. A dedicated pass to actually redesign the remaining dashboard
   sections (charts/calendar/analytics) and the other ~14 pages, sized
   and scoped as its own project rather than folded into an
   already-large session.
3. Consider Playwright or a real Capacitor build in CI once network
   access is available, so future passes in an environment like this
   one can move from "verified by reading" to "verified by rendering."

---

## Session 2 — Status bar, bottom navigation, dark-mode dialog completion

Builds on Session 1 below (merged in full, verified via diff, nothing
lost — see `CHANGELOG.md`). Real, verified findings only.

### Fixed

**Status bar overlap — the actual root cause, on 4 headers.**
`native-safe-top` (a safe-area CSS utility) already existed with a code
comment literally saying it was meant for "Owner Topbar, Tenant Portal
header" — but neither actually had the class applied, nor did
`AdminTopbar`. All three used a *fixed* height (`h-14`/`h-16`) with
`sticky top-0` and zero safe-area padding, which is exactly what
overlaps the Android status bar. Fixed by changing each to `min-h-*`
(so the added padding grows the header instead of squishing its
content) plus the safe-area class. A 4th, separate bug: the tenant
`OnboardingWizard`'s `TopAppBar` referenced a `tenant-safe-top` CSS
class that **did not exist anywhere** — defined it (mirroring
`native-safe-top`), fixing a real, previously-invisible gap.

**Owner and Tenant had no real bottom navigation at all.** Both relied
entirely on a hamburger-menu-triggered sidebar drawer on mobile — a
website-admin-panel pattern, not a native app pattern, and exactly what
the reference brief asked to fix. Added:
- `OwnerBottomNav` (new, `owner/ui/`) — Dashboard, Payments, Add Tenant,
  Approvals, Profile, wired to the 5 real existing routes
  (`/dashboard`, `/payments`, `/tenants`, `/approvals`, `/settings`) via
  `usePathname`/`useRouter`, exactly mirroring `Sidebar.tsx`'s own link
  list. Uses `owner-*` theme tokens, safe here since
  `(owner)/layout.tsx` already loads `owner-theme.css`.
- An inline tenant bottom nav (Dashboard, Payments, Requests, Chat,
  Profile) added directly in `portal/page.tsx`, mapped onto the
  page's existing `Tab` state and its existing `openMessagesTab()`/
  `setProfileMenuOpen()` handlers — **no new tab, route, or page was
  created.** Built with this page's own actual Tailwind conventions
  (indigo accent, gray neutrals) rather than the `tenant/ui` design
  system — see "important architecture note" below for why.
- Both are `lg:hidden` (desktop keeps the existing sidebar unchanged)
  and both pushed `pb-24` onto their page's main content so nothing
  renders hidden behind the new fixed bar.

**Dark-mode dialog shells completed for the 6 owner/admin modals
flagged in Session 1** (`admin`, `waiting-list`, `approvals`, `tenants`,
`visitors`, `parcels`) — card background and header bar now respond to
dark mode. **Scope note:** this fixes the shell (what was actually
visually broken — a solid white block in an otherwise-dark screen); it
does not re-color every individual text/border style inside each
modal's body content, since those inherit `text-foreground` (already
dark-mode-aware via the existing CSS variables) in most cases. A
pixel-by-pixel pass on each modal's internal content is still worth
doing with real visual verification, not a blind sweep — see
recommendations.

**The 7th flagged modal (`join/[slug]/page.tsx`) was deliberately left
light-only.** Checked first: this pre-auth onboarding page has zero
`dark:` classes anywhere and no dark-mode toggle at all — it's an
intentionally always-light flow, confirmed by reading the file, not
assumed. Adding dark classes to only its modal would be inconsistent
with the rest of that specific page.

### Important architecture note discovered this session
The tenant `BottomNav`/`TopAppBar`/`IconButton` components in
`components/tenant/ui/` use `tenant-*` Tailwind tokens that only resolve
inside a `.tenant-portal` element with `tenant-theme.css` loaded and
`<TenantThemeProvider>` mounted. **The actual rendered Tenant Portal
(`(tenant)/portal/page.tsx`) never loads any of that** — it's built
entirely with its own separate, hardcoded-color Tailwind styling and
its own independent `darkMode` state. This means the `tenant/ui`
design-system components are currently unused/orphaned in the real
app. Rather than force-fit an incompatible design system into a page
that doesn't support it (a real regression risk with no visual QA
available), the new tenant bottom nav matches the portal page's actual
existing visual language instead. Reconciling these two parallel
systems is a real, worthwhile future project — not attempted here since
it's a much larger change than "add a bottom nav."

### Not verified in this environment
No real-device or Capacitor build test of the status-bar fix, the new
bottom navs, or the dark-mode dialog changes — verified by reading the
resulting CSS/class output and reasoning through the box model (e.g.
`min-h-14` + `native-safe-top`'s padding growing the box rather than
squishing content), not by rendering on hardware. Recommended before
the next release.

### Recommendations
1. Real-device verification of the status bar fix specifically (the
   highest-priority item in this pass) before shipping.
2. A dedicated, visually-verified dark-mode pass on the 6 modals'
   internal content (not just the shell).
3. Consider whether the Tenant Portal should eventually adopt
   `tenant-theme.css`/`tenant/ui` properly, or whether that design
   system should be retired in favor of the portal's actual styling
   approach — right now both exist, which is its own source of
   confusion for future work.
4. Wire `/tenants?action=add` (or similar) so the owner bottom nav's
   "Add Tenant" opens the add-tenant modal directly instead of just
   landing on the Tenants list — small, low-risk follow-up, not done
   here to keep this pass's routing changes at zero.

---

## Session 1 — Native App Feel (Capacitor Android + Installed PWA)

Real, verified findings from an audit of this codebase's actual CSS,
Tailwind config, and component patterns — checked by reading and
grepping the real files, not assumed. A fair amount of native-feel work
already existed here from earlier phases (input zoom prevention,
safe-area padding, tap-highlight removal, `touch-action: manipulation`,
focus-visible states) — this pass found and fixed what was still
missing, and explicitly notes what was already correct rather than
re-doing it.

## Fixed

### 1. Sticky hover on every touchscreen tap (app-wide)
**Issue:** 55 files use Tailwind `hover:` classes, which by default
compile to a plain `:hover` — on Android/iOS touchscreens this applies
on tap and stays visually "stuck" until the user taps elsewhere. One of
the most common "this feels like a website" tells.
**Fix:** Added a Tailwind plugin (`tailwind.config.ts`) that redefines
the `hover` variant to only engage on pointers that support true
hovering (`@media (hover: hover) and (pointer: fine)`). This fixes every
`hover:` class across all 55 files with one change — no component file
needed editing.

### 2. Icon button touch targets below 48×48dp
**Issue:** Both design systems' `IconButton` size scales fell short of
the 48dp minimum: owner `sm` 28px/`md` 36px/`lg` 44px; tenant `sm`
32px/`md` 40px (only tenant's `lg` at 48px already met it).
**Fix:** Rather than growing the visible icon size (which would ripple
into spacing everywhere these are used — tight toolbars, table row
actions — a real "redesign" risk), added an invisible `after:` pseudo-
element hit-area expansion to each size variant, the standard Material
Design pattern for this exact situation. Visible size, spacing, and
layout are completely unchanged; only the tappable area grows to 48px.

### 3. No global horizontal-overflow safeguard
**Issue:** `html`/`body` had no `overflow-x` rule at all — any future
(or currently unnoticed) wide element could create page-level
horizontal scroll/rubber-banding, jarring in a native shell.
**Fix:** Added `overflow-x: hidden` to `html, body` in `globals.css`.
Doesn't affect intentional horizontal-scroll containers (a wide table's
own `overflow-x-auto` wrapper is a different, independently-scrolling
element).

### 4. Every dialog/modal used a "website popup" pattern on mobile
**Issue:** Found 25 modal instances across 14 files, all using the
identical pattern: a centered, scale-in card floating in the middle of
a dark backdrop **at every screen size, including phones**. On a small
viewport this reads as a website's popup dialog, not a native Android
bottom sheet or full-screen flow.
**Fix:** Converted all 25 instances (verified none missed, none
mismatched) to anchor to the bottom of the screen with a slide-up
entrance on mobile (`items-end`, `rounded-t-2xl`, `animate-*-sheet-up`,
edge-to-edge with `p-0`, `pb-safe` for the gesture-area), while keeping
the existing centered/scale-in look completely unchanged from `sm:`
(≥640px) up — tablets and desktop look exactly as before. This is
additive responsive behavior, not a redesign: nothing about a dialog's
content, copy, fields, or desktop appearance changed.

## Reviewed, already correct — no change needed
- **Input zoom prevention:** `font-size: 16px !important` on all
  `input`/`select`/`textarea` under 768px width was already in place
  (documented in the CSS itself as "Phase 6.8").
- **Tap highlight / 300ms tap delay:** `-webkit-tap-highlight-color:
  transparent` and `touch-action: manipulation` already on `body`.
- **Scroll architecture:** the app uses a single document-level scroll
  (no `overflow-y-auto` wrapping the main content area), which already
  satisfies "only one smooth scroll area per screen" — confirmed by
  reading `OwnerShell.tsx`, not assumed.
- **Sticky header / bottom nav:** `Topbar.tsx` uses `sticky top-0`
  (correct for a document-scroll layout); `BottomNav.tsx` already uses
  `fixed bottom-0` with a `tenant-safe-bottom` class for the gesture-area
  inset — already built correctly.
- **Focus-visible states:** already present on shared `Button`/
  `IconButton` from an earlier accessibility pass.
- **Explore Mode / App Update System dialogs:** already used the native
  bottom-sheet pattern correctly from when they were first built — this
  pass's modal fix (#4 above) brings the rest of the app's dialogs up to
  that same standard.

## Found, not fixed — flagged for a follow-up pass
- **Dark mode gaps in 7 of the 25 fixed modals.** `join/[slug]`,
  `admin`, `waiting-list`, `approvals`, `tenants`, `visitors`, and
  `parcels` use a hardcoded `bg-white` card (not the theme-aware
  `bg-owner-surface-elevated` the other modals use) — pre-existing, not
  introduced by this pass. Fixing this properly means checking each
  modal's text/border colors for dark-mode contrast too, which is a
  larger, separate pass best done with visual verification on a real
  device/screenshot tool, not blind find-and-replace.
- **Legacy "Move-Out Checklist" modal in `tenants/page.tsx`** was found
  mid-audit already partially converted to a responsive pattern by an
  earlier, unrelated change (per a comment in that file noting it was a
  "ported feature") — brought to full consistency with the rest of this
  pass's fix, since it was directly adjacent and low-risk to finish.

## Not verified in this environment
- No real-device testing (small/large Android phones, tablets,
  landscape/portrait) — the modal/touch-target fixes were verified by
  reading the resulting CSS classes and hand-computing the resulting
  pixel dimensions (documented inline in each component), not by
  rendering on hardware.
- No Lighthouse run, no actual Capacitor Android build/install test —
  standing limitation of this sandbox (no Android SDK, no device).
- The generated `android/` project's `styles.xml` was spot-checked and
  looks like a standard, unmodified Capacitor scaffold — edge-to-edge
  and status bar behavior are handled at runtime by
  `src/lib/native/bootstrap.ts` (from an earlier pass), not by
  `styles.xml` itself, so no native-side change was needed here.

## Recommendations for future passes
1. Roll dark-mode consistency across the 7 flagged modals, verified
   with actual screenshots (light + dark) rather than a blind sweep.
2. Consider extracting the now-25-times-repeated modal-shell pattern
   (backdrop + responsive card) into one shared `<Modal>` component —
   it was left as-is per "reuse existing components... update only
   files that need modification" (extracting a new shared component
   across 14 files is a bigger structural change than this pass's
   mandate), but the repetition itself is worth addressing once a
   dedicated refactor pass is in scope.
3. Real-device pass (a handful of representative Android phones +
   tablet, portrait + landscape) before the next Play Store-track
   release, to catch anything a CSS reading can't.
