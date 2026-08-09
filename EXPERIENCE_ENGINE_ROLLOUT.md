# EXPERIENCE_ENGINE_ROLLOUT.md

Phase 7 (final phase of the original roadmap): consolidates Phases 1–6
into an operating guide for turning this on, and what a future Website
build needs from it. **No code changes this phase** — `engine.ts`,
`dateResolver.ts`, `priorityResolver.ts`, `types.ts`,
`ExperienceProvider.tsx`, `layout.tsx`, and every `packs/*.ts` file are
untouched (md5-identical to end of Phase 6).

See `EXPERIENCE_ENGINE.md` for the full architecture reference this
document assumes.

## Where things stand
- 60 packs across all 5 categories, all pure immutable configuration.
- Engine fully wired: flag → config source → date resolver → priority
  resolver → frozen `ResolvedExperience`.
- `ExperienceProvider` mounted in `layout.tsx`, reflecting the resolved
  pack as `data-experience` + `--exp-*` on `<html>`, and exposing
  `useExperience()`.
- **Nothing renders any of it yet.** No component reads
  `useExperience()`; no CSS rule references `--exp-*`. The flag also
  defaults OFF. Both of these are why the app is still pixel-identical
  to pre-Phase-1 production.

## How to actually turn this on

### Step 1 — a screen has to consume it
Right now, even with the flag on, the *only* observable effect is an
attribute and some unused CSS custom properties on `<html>` — nothing
visually changes because nothing reads them. Turning this on for real
means picking a first, low-risk consumer. Recommended first target,
smallest surface area: the Owner/Tenant dashboard greeting. Sketch:

```tsx
'use client'
import { useExperience } from '@/components/shared/ExperienceProvider'

export function DashboardGreeting({ fallback }: { fallback: string }) {
  const experience = useExperience()
  const greeting = experience.active ? experience.pack.greeting?.default : undefined
  return <h1>{greeting ?? fallback}</h1>
}
```
This is intentionally the smallest possible integration: text only, no
layout change, an explicit `fallback` so the component is identical to
today's behavior whenever `experience.active` is `false` (flag off, or
no pack currently active — the overwhelmingly common case). Accent
colors, decorative illustrations, and animation would each be their own
small, separately reviewable follow-up component in the same spirit —
none of that is built yet, and none of it should be built inside
`ExperienceProvider` itself (see "Provider Responsibilities" from Phase
2 — still holds).

### Step 2 — staged flag rollout
`NEXT_PUBLIC_EXPERIENCE_ENGINE_ENABLED` is a build-time env var (Next.js
inlines `NEXT_PUBLIC_*` at build time), so "turning it on" means: set it
in the target environment's env config, then redeploy that environment.
Suggested order, each with a real observation period before the next:
1. Local/dev only.
2. A preview/staging Vercel deployment (if one exists in this project's
   Vercel setup) — the ExploreMode-gated preview environment mentioned
   in `ARCHITECTURE.md` may already be a natural fit for this.
3. Production, once whatever Step 1 component(s) have been reviewed and
   merged.
Rolling back at any point is unsetting the env var and redeploying — no
code revert needed, per the Phase 1 design goal.

### Step 3 — decorative assets
Every `decorativeAssets[].ref` across all 60 packs is a placeholder path
(e.g. `/experience/festival/diwali.svg`) — no file exists at any of
these paths yet. Before any pack's decoration can render for real,
actual SVG/JSON assets need to be created (or commissioned) and placed
under `public/experience/<category>/`. This is a content/design task,
not an engineering one, and is fully decoupled from the engine — adding
real files doesn't require touching any pack's `ref` string, since the
path was chosen to match the final intended location already.

## Deferred items (tracked, not forgotten)
| Item | Status | Notes |
|---|---|---|
| `experience-tokens.css` (static token-defaults stylesheet) | Deferred since Phase 2 | Add once a real consumer needs default/fallback `--exp-*` values beyond what a pack supplies. |
| Tailwind `exp.*` color mapping | Deferred since Phase 2 | Add once a component wants `bg-exp-primary`-style utilities, mirroring `tenant.*`/`owner.*` in `tailwind.config.ts`. |
| Remote config source (`SupabaseConfigSource` or Admin-Panel-backed) | Interface-ready since Phase 1, not implemented | `ExperienceConfigSource` is the seam; swapping `LocalConfigSource` for a remote one in `ExperienceProvider.tsx` is a one-line change. This is also the natural path to a shared Admin Panel controlling both Website and APK, per the original brief. |
| Annual Festival date refresh | Process documented, not automated | `packs/festival.ts` has 2026 dates only. Before 2027, append fresh Drik-Panchang-sourced dates to each pack's `dates` array. Consider a lightweight yearly reminder/checklist rather than trying to compute panchang dates algorithmically. |
| Real decorative assets | Not started | See Step 3 above. |
| Campaign activation UI | Not started | Today: hand-edit `enabled: true` in `campaign.ts`. Eventually: an Admin Panel toggle, once the remote config source exists. |

## Website readiness
The original brief's core requirement: *"Website and APK should
eventually share the same Experience Engine architecture."* Here's what
that means concretely, given what exists after Phase 6.

**Directly reusable, as-is, zero changes:** the entire `src/lib/experience/`
directory — `types.ts`, `flag.ts`, `configSource.ts`, `dateResolver.ts`,
`priorityResolver.ts`, `immutable.ts`, `engine.ts`, and every file under
`packs/`. None of it imports React, Next.js, Capacitor, or any DOM API —
it's plain TypeScript, verified throughout Phases 1–6 by running it
directly under plain Node. A Website codebase (presumably also Next.js,
based on the brief's framing) can import this folder unchanged and get
identical pack content and identical resolution behavior for free — the
"one source of truth" requirement from the original brief.

**Needs a Website-side equivalent, not a shared one:** `ExperienceProvider.tsx`
is the one piece that touches the DOM (`document.documentElement`) and
React context — by nature, framework/DOM glue can't be shared as a
single file across two separate Next.js apps without a shared package.
The Website would write its own ~80-line provider following the exact
same contract documented in Phase 2 (call the engine, set
`data-experience` + `--exp-*` on its own `<html>`, expose
`useExperience()`) — a port of a well-defined pattern, not new design
work.

**Recommended next structural step, once a Website repo exists:**
extract `src/lib/experience/` into a shared private package (e.g. an npm
workspace or a small internal package published to a private registry)
that both the APK's Next.js app and the Website's Next.js app depend on.
Until that extraction happens, the pragmatic interim option is
copying the folder into the Website repo — acceptable short-term, but
creates drift risk (a pack edited in one repo and not the other) that
the shared-package approach eliminates. This project's `ARCHITECTURE.md`
already documents an owner/tenant dual-design-system split within one
app; a shared `@rentivo/experience-engine` package would be a similar,
proven kind of boundary, just at the multi-app level instead of the
multi-shell level.

## Summary of everything built (Phases 1–6)
1. **Engine core** — schema, feature flag, config source abstraction,
   date resolver, priority resolver, immutability guarantee.
2. **Provider wiring** — `ExperienceProvider`, zero-DOM-footprint,
   `data-experience` + `--exp-*` injection, `useExperience()` context.
3. **Seasonal packs** — 4, full-year coverage, no gaps/overlaps.
4. **National + Remembrance packs** — 27, including two verified
   real-calendar priority collisions resolved correctly.
5. **Festival packs** — 18, `explicit-dates`-based, 2026 sourced from
   Drik Panchang, one more verified real-calendar collision.
6. **Campaign packs** — 11, `manual`-based, all disabled by default,
   verified to correctly override every other category at once when
   enabled.

60 packs, zero regressions at any phase (md5-verified engine/provider
files unchanged since Phase 2), zero visual change with the shipped
defaults (flag OFF). The architecture is ready for a first real UI
consumer whenever that's wanted next.
