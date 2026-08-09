# EXPERIENCE_ENGINE.md

Status: **Phase 7 complete (final phase) — 60 packs, engine fully wired,
zero regressions across all six build phases. See
`EXPERIENCE_ENGINE_ROLLOUT.md` for how to actually turn this on, what's
deferred, and what a Website build needs.**

## What this is
A configuration-driven layer that decides which single "Experience Pack"
(a national day, remembrance day, festival, season, or manual campaign)
should be active at any given moment, so the UI can later apply small,
reversible decoration (accent colors, greetings, banners — never layout
or business logic) around it. See the original product brief for the
full theme catalogue and rules; this document covers the engine that
implements it.

## Where it lives
```
src/lib/experience/
  types.ts             ExperiencePack schema, DateRule union, validation
  flag.ts               master feature flag
  configSource.ts        ExperienceConfigSource interface + LocalConfigSource
  dateResolver.ts         date/window matching
  priorityResolver.ts      pick exactly one active pack
  immutable.ts              freezeDeep() — read-only guarantee (Phase 2)
  engine.ts                  resolveActiveExperience() — the entry point
  packs/
    helpers.ts                fixedDatePack() + explicitDatePack() + manualPack() — authoring convenience only
    seasonal.ts                Phase 3 — Spring/Summer/Monsoon/Winter
    national.ts                  Phase 4 — all 21 National Day packs
    remembrance.ts                Phase 4 — all 6 Remembrance Day packs
    festival.ts                     Phase 5 — all 18 Festival packs (2026 dates)
    campaign.ts                       Phase 6 — all 11 Campaign packs (all disabled by default)
    index.ts                            allPacks — aggregates every category's array
  localPacks.ts                 = freezeDeep(allPacks) — what the app actually uses
  index.ts                       public exports — import from '@/lib/experience'

src/components/shared/
  ExperienceProvider.tsx    Phase 2 — calls the engine, injects
                             data-experience + --exp-* onto <html>,
                             exposes useExperience(). No decision logic.
```
The `src/lib/experience/` core still has no knowledge of React, the DOM,
or Tailwind — that boundary hasn't moved. `ExperienceProvider` is the one
and only place those two worlds meet, and it is intentionally thin: it
calls the engine and reflects the result, nothing more.

## The feature flag
`NEXT_PUBLIC_EXPERIENCE_ENGINE_ENABLED` — set to the literal string
`"true"` to enable, anything else (including unset) disables. **Default
is OFF.** When off, `resolveActiveExperience()` returns
`{ active: false, reason: 'flag-disabled' }` immediately, without calling
the config source, evaluating any date, or running the priority
resolver. This is the "instantly disable the entire engine without
removing code" switch from the Phase 1 requirements — flip the env var
and redeploy, nothing else changes.

A `flagOverride` option exists for tests (and possibly a future in-app
preview toggle) so the flag doesn't require mutating `process.env`.

## The configuration source abstraction
The engine only depends on:
```ts
interface ExperienceConfigSource {
  getPacks(): Promise<ExperiencePack[]>
}
```
Phase 1 ships one implementation, `LocalConfigSource`, backed by the
plain array in `localPacks.ts`. A future `SupabaseConfigSource` (reading
an `experience_packs` table, written to by an Admin Panel) or a
`RemoteApiConfigSource` implements the exact same interface — swapping
sources is a one-line change wherever the config source is constructed
(that call site doesn't exist yet; it will be created in the phase that
wires the engine to the UI). **No change to `engine.ts`,
`dateResolver.ts`, or `priorityResolver.ts` is ever required to change
where configuration comes from.**

## The pack schema
An `ExperiencePack` has:
- `id`, `name`, `category` (`campaign | remembrance | national | festival
  | season`), `enabled`
- `dateRule` — one of:
  - `fixed-date` — recurring Gregorian month/day (national/remembrance
    days), with optional `windowDaysBefore`/`windowDaysAfter`
  - `explicit-dates` — a list of `'YYYY-MM-DD'` occurrences, required for
    lunar/panchang festivals whose date shifts yearly; adding a future
    year is adding one string to the array
  - `date-range` — recurring `'MM-DD'`–`'MM-DD'` window for seasons,
    with wrap-around support (e.g. Dec–Feb)
  - `datetime-range` — one-off precise ISO start/end for manual campaigns
  - `manual` — active whenever `enabled: true`; the toggle IS the
    schedule
- `respectfulMode` — **required `true`** on every `remembrance` pack;
  `validatePack()` rejects a remembrance pack missing it. This is schema
  enforcement of the "no celebration animations on remembrance days"
  product rule; the engine itself is decoration-agnostic — enforcing
  *which* decorations respect this flag is the UI phase's job.
- `priorityOverride`, `timezone` (default `Asia/Kolkata`), `tokens`,
  `meta` — forward-compatible fields.
- `accentPalette`, `greeting`, `decorativeAssets`, `animationProfile`,
  `accessibility` — added Phase 3. **Category-agnostic**: a Festival,
  National Day, Remembrance, or Campaign pack in a future phase uses
  these exact same fields, unchanged. `validatePack()` enforces two
  rules on these generically, for every category: an `animationProfile`
  must set `gpuFriendly: true` and `respectsReducedMotion: true`; an
  `accessibility` block must set `respectsReducedMotion: true` and
  `decorativeOnly: true`. Nothing in the engine branches on category or
  pack id to apply these — they're schema-level constraints.

Adding a new event/season/campaign in any future phase is: append one
`ExperiencePack` object to a config source. No engine file changes.

## Seasonal packs (Phase 3)
Four packs in `packs/seasonal.ts` — `springPack`, `summerPack`,
`monsoonPack`, `winterPack` — each `category: 'season'` (priority 5, the
lowest of the five real categories) using a recurring `date-range` rule.
Ranges are contiguous and cover the full year exactly once with no gap
or overlap:

| Pack | Range (IST, recurring) |
|---|---|
| Winter | Oct 01 – Feb 14 (wraps the year boundary) |
| Spring | Feb 15 – Mar 31 |
| Summer | Apr 01 – Jun 15 |
| Monsoon | Jun 16 – Sep 30 |

Each pack is pure data — no engine file contains the word "spring",
"summer", "monsoon", or "winter" (grep-verified). `tokens` and
`accentPalette` use the same raw-HSL-triplet convention as
`tenant-theme.css`/`owner-theme.css`. `decorativeAssets` reference
placeholder paths only (e.g. `/experience/seasonal/spring-blossom.svg`)
— no asset files were created this phase, per the brief. Every pack's
`animationProfile.style` (`drift`, `shimmer`, `rain`, `twinkle`) is a
free-form string the engine never inspects; only a future renderer would
interpret it.

These four packs now live in `localPacks` (via `packs/index.ts`'s
`allPacks`), so they participate in real resolution — but since the
provider only *reflects* whatever the engine resolves, and the flag
defaults OFF, none of this is visible yet.

## National + Remembrance packs (Phase 4)
`packs/national.ts` (21 packs, `category: 'national'`, priority 3) and
`packs/remembrance.ts` (6 packs, `category: 'remembrance'`, priority 2)
cover every day listed in the product brief. Both files use a shared
authoring helper, `packs/helpers.ts`'s `fixedDatePack()` — pure
boilerplate reduction, never imported by the engine, producing ordinary
`ExperiencePack` objects.

Every Remembrance pack sets `respectfulMode: true` (schema-required since
Phase 1) and structurally avoids celebration: no `animationProfile` is
set on any of the six, and `decorativeAssets` use only the
`'illustration'` type — never `'particle'` — with muted, low-saturation
`accentPalette` values. This is content discipline applied in the pack
file, not engine enforcement (beyond the `respectfulMode` schema check
itself).

Two real-calendar collisions exist between these two files on purpose:
Lal Bahadur Shastri Jayanti (remembrance) and Gandhi Jayanti (national)
both fall on Oct 2; 26/11 Remembrance and Constitution Day both fall on
Nov 26. Both resolve correctly to the Remembrance pack (priority 2 beats
priority 3) via the unmodified Phase 1 `priorityResolver.ts` — a live
demonstration that the priority ladder needs no per-day special-casing
to handle real-world overlaps correctly.

## Festival packs (Phase 5)
`packs/festival.ts` (18 packs, `category: 'festival'`, priority 4) —
Makar Sankranti through Tulsi Vivah. These use `explicit-dates`, not
`fixed-date`: every one is set by the Hindu lunisolar (panchang)
calendar, so its Gregorian date shifts roughly 10–20 days every year.
A `fixed-date` rule would silently be wrong for these; `explicit-dates`
is correct by construction, at the cost of needing one new date string
appended per pack, per year.

**Only 2026 dates are populated.** Sourced from Drik Panchang
(drikpanchang.com), cross-checked against several independent
festival-calendar sources for agreement, on 2026-08-02. A couple of
festivals (Ram Navami, Janmashtami) have a one-day variance between
Smarta and Vaishnav/ISKCON tradition in some years — the more widely
observed Smarta date was used where that applied.

**Annual maintenance**: before 2027, append `'2027-MM-DD'` to each
pack's `dates` array in `festival.ts`, sourced fresh from Drik Panchang
(or an equivalent authoritative panchang) each year — panchang dates are
not arithmetic and should never be extrapolated from a prior year's
date. No other file changes.

Two packs carry a short window as ordinary config (not special-cased):
Navratri (`windowDaysAfter: 8`, spanning its own 9 nights, ending the
day before Dussehra — a separate pack); Diwali (`windowDaysBefore: 1`,
`windowDaysAfter: 1`, covering its conventional short span around the
main Lakshmi Puja day; Bhai Dooj remains its own pack a few days later).

A real cross-category collision exists between this file and Phase 4's:
Hindi Diwas (national) and Ganesh Chaturthi (festival) both fall on Sep
14, 2026. National correctly outranks Festival (priority 3 vs. 4),
verified end-to-end against the real registry.

## Campaign packs (Phase 6)
`packs/campaign.ts` (11 packs, `category: 'campaign'`, priority 1 — the
highest tier in the whole ladder) — Admission Open through New Facility
Launch. Every pack uses `dateRule: { type: 'manual' }`: unlike every
other category, there's no calendar fact to derive activation from — an
"Offer Week" or an "Anniversary" date is business-specific and unknown
to this codebase, so `manual` (activation = the `enabled` flag itself)
is the correct, honest rule, not a guess dressed up as a date.

**Every one of the 11 ships `enabled: false`.** This matters more here
than anywhere else in the engine: Campaign is priority 1, so an enabled
campaign doesn't compete on a date — it's simply the active experience
the moment the master flag is on, unconditionally overriding every
calendar-driven pack. `manualPack()` (the third authoring helper,
alongside `fixedDatePack()`/`explicitDatePack()`) defaults `enabled` to
`false` for exactly this reason — the opposite default from the other
two helpers, and intentionally so.

Cricket Fever and Cinema Week keep their copy and decoration
deliberately generic — no team names/logos, no movie titles/studio
branding — per the brief's copyright-safety requirement.

Turning a campaign on (currently: editing `enabled: true` directly in
`campaign.ts`; later, once a remote config source exists per the Phase 1
abstraction, via an Admin Panel) was verified to correctly override
every other simultaneously-active pack at once — not just pairwise: an
enabled campaign beat both Festival + Season together (Nov 8: Diwali +
Winter) and both Remembrance + National together (Nov 26: 26/11 +
Constitution Day) in the same test run.

With Phase 6 complete, all five categories from the product brief
(Seasonal, National, Remembrance, Festival, Campaign) exist in
`localPacks` — 60 packs total. No further pack-content phases remain on
the original roadmap; Phase 7 is documentation/website-readiness only.

## Immutability guarantee (Phase 2)
Every pack the engine hands to a resolver, and the final
`ResolvedExperience` it returns, is deep-frozen via `freezeDeep()`
(`immutable.ts`) — recursively `Object.freeze`s the object graph
(`dateRule`, `tokens`, `meta` included). This happens automatically
inside `resolveActiveExperience()`; callers don't opt in or out. Mutating
any field throws in strict mode. This is what makes the engine's
behavior deterministic across repeated calls and across future
consumers (Website + Android APK) that share it — nobody can accidentally
mutate a pack and have that leak elsewhere. `localPacks.ts`'s exported
array is frozen too, reinforcing the guarantee at the source, not just
at the engine's output boundary.

## The provider (`ExperienceProvider`)
`src/components/shared/ExperienceProvider.tsx`, mounted once in
`src/app/layout.tsx` wrapping `{children}`. Its contract is strictly
mechanical:
1. Call `resolveActiveExperience()` (via a shared `LocalConfigSource`
   over `localPacks`) on mount.
2. If a pack is active, set `document.documentElement.setAttribute('data-experience', pack.id)`;
   otherwise no attribute is set.
3. For each entry in the active pack's `tokens`, set
   `document.documentElement.style.setProperty('--exp-' + key, value)`;
   on resolution change or unmount, those exact properties are removed
   again (tracked, not guessed).
4. Expose the resolved value via `useExperience()` (React context) for
   any future component that needs to read it without re-resolving.

It deliberately contains **no** `getMonth`/`getDate`/date-window math,
**no** `CATEGORY_PRIORITY` or priority comparisons, and **no**
`pack.category`/`pack.dateRule` branching — every decision was already
made by the engine before the provider sees the result. If a future
change adds any of that to this file, it no longer belongs there — it
belongs in `engine.ts` or one of the resolvers.

Renders no DOM element of its own — `<ExperienceContext.Provider>` is
not a host element, so mounting the provider added zero nodes to the
tree. It also writes to `<html>`, never to a wrapper `<div>`, specifically
so it can never disturb the flex/height chains inside the Owner, Tenant,
or Admin shells, and specifically so it can never collide with those
shells' own `data-theme` attribute (which lives on `.owner-shell` /
`.tenant-portal`, not on `<html>`).

**Zero-diff guarantee:** with the flag off (default) or on with an empty
pack registry, `resolved.active` is always `false`, so step 2 and 3 never
run — no attribute, no CSS variable, no visual or functional change from
today's production build. This was true by construction (the engine's
own flag/empty-registry short-circuits), and was verified at the
provider layer this phase too.

### Why no static `experience-tokens.css` yet
The "`--exp-*` CSS variable layer" this phase is the *injection
mechanism* (`element.style.setProperty`), not a static stylesheet of
default values — no pack contributes any `tokens` yet (`localPacks` is
empty), so there is nothing for a stylesheet to define defaults for.
Once Phase 3+ introduces real packs with real token values, a static
`experience-tokens.css` documenting the `--exp-*` namespace contract
(and any safe fallback values) can be added without touching this
provider. Tailwind `exp.*` color-token mapping (mirroring how `tenant.*`
and `owner.*` work in `tailwind.config.ts`) is deferred the same way —
add it once a component actually needs `bg-exp-*`-style utilities.

## Priority resolution
Only one pack is ever active. Precedence (lower wins):
`campaign(1) > remembrance(2) > national(3) > festival(4) > season(5)`.
Ties are broken deterministically by `id` — same input always produces
the same output. "User Selected Base Theme" and "Default Premium Dark
Theme" (priority 6/7 in the product brief) are not packs at all; they're
what the app already does today, i.e. what happens when
`resolveActiveExperience()` returns `active: false`.

## Verification strategy
No test runner is configured in this project (`package.json` has no
`test` script). All six phases were verified by running the actual
compiled engine (Node 22's native TypeScript support, no new dependency)
against assertions, plus static grep/md5-based checks:

- **Phase 1** (24 assertions): schema validation, all four date-rule
  types, enabled-flag filter, priority precedence, deterministic
  tie-breaks, flag-off short-circuit, empty-config handling, malformed-
  pack skipping.
- **Phase 2** (10 assertions): resolved output and every nested field
  confirmed frozen, mutation confirmed to throw, empty-registry and
  flag-off paths confirmed inactive, `freezeDeep` idempotency.
- **Phase 3** (43 assertions): all 4 seasonal packs load, validate, and
  are frozen inside the real `localPacks`; date resolution at every
  boundary (incl. Winter's year-wrap); exactly one seasonal pack active
  on 10 sampled dates spanning the full year; priority resolution;
  end-to-end resolution with flag on/off; generic schema-level rejection
  of a bad `animationProfile`/`accessibility` object; static grep
  confirming zero season-specific code in the engine or provider.
- **Phase 4** (89 assertions): pack counts (21 national, 6 remembrance,
  31 total registry), all pass `validatePack()` and are frozen; no
  duplicate ids; every remembrance pack directly inspected for
  `respectfulMode: true`, absence of `animationProfile`, and absence of
  `particle`-type assets; the two intentional real-calendar collisions
  (Oct 2, Nov 26) both confirmed to resolve to the Remembrance pack over
  the National one; md5sum confirming the engine/provider files were
  byte-identical to Phase 3.
- **Phase 5** (82 assertions): pack count (18), all valid and frozen, no
  duplicate ids across 49 packs; Diwali's pre/post window boundaries and
  Navratri's full 9-night span with correct cutoff at Dussehra; a
  festival pack confirmed **inactive** in a year outside its
  `explicit-dates` list; the real Sep 14 collision (Hindi Diwas vs.
  Ganesh Chaturthi) confirmed to resolve to National over Festival;
  md5sum confirming byte-identical to Phase 4.
- **Phase 6** (105 assertions): pack count (11), all valid and frozen,
  no duplicate ids across the full 60-pack registry; every campaign
  pack directly inspected for `enabled === false` and
  `dateRule.type === 'manual'`; shipped defaults (all disabled) proven
  to leave calendar resolution completely unaffected; **the core
  guarantee** — a locally-simulated enabled campaign overrides
  Festival+Season together and Remembrance+National together, in the
  same test run, not just pairwise; two simultaneously-enabled campaigns
  proven to resolve to exactly one, never merged; flag-off proven to
  ignore even a force-enabled campaign; md5sum confirming the
  engine/provider/schema files are byte-identical to Phase 5.

All verification scripts were scratch files, not committed to the
project. Re-verification in a future phase should be promoted to a real
test file once a test runner is introduced (still not a hard requirement
of any phase so far).

## What's explicitly NOT in Phase 6
- No hardcoded colors/animations/decorations in any engine file — every
  visual value is data inside a pack object.
- No screen, layout, navigation, or business-logic change.
- No actual decorative asset files — placeholder path strings only.
- No engine, provider, or schema (`types.ts`) file touched — md5-verified
  identical to Phase 5.
- No campaign enabled by default — verified as the shipped state.
- No static `experience-tokens.css`, no Tailwind `exp.*` mapping — both
  still deferred (see Phase 2 section above); still not required since
  nothing renders a pack's tokens yet.
- No Admin Panel / remote config source implementation — `manual` packs
  are still toggled by hand-editing `campaign.ts`; the `ExperienceConfigSource`
  abstraction from Phase 1 is what would let a future Admin Panel do this
  instead, with zero engine changes.

## All five categories now complete
As of Phase 6, `localPacks` contains all 60 packs across every category
in the product brief: 4 Seasonal, 21 National, 6 Remembrance, 18
Festival, 11 Campaign. No pack-content work remains on the original
roadmap. Every phase from 3–6 added exactly one new `packs/<category>.ts`
file and one line to `packs/index.ts` — `engine.ts`, `dateResolver.ts`,
`priorityResolver.ts`, `ExperienceProvider.tsx`, and `layout.tsx` have
been byte-for-byte unchanged since the end of Phase 2, confirmed by
md5sum at the end of every subsequent phase. This is the "one new
configuration object, zero engine changes" guarantee from the original
brief, demonstrated five times over.

## Next (Phase 7, pending approval)
Per the approved roadmap, the final phase: documentation and
Website-readiness notes. No new pack content, no engine changes expected
— primarily consolidating what's been built across Phases 1–6 into a
clear "how to actually turn this on" operating guide (flag rollout,
which screens would need to start calling `useExperience()` to render
anything, and what the Website implementation would need to share vs.
reimplement), plus flagging any deferred items (`experience-tokens.css`,
Tailwind mapping, remote config source, annual festival-date refresh)
as a tracked follow-up list rather than open-ended gaps.

## Phase 7 — complete
Done, documentation-only, zero code changes. See
`EXPERIENCE_ENGINE_ROLLOUT.md` for the rollout plan, the deferred-items
tracker, and the Website-readiness assessment. This closes out the
original roadmap: the Experience Engine is fully built, fully verified
across six phases (353 total assertions run against the real compiled
code, zero failures), and ready for a first real UI consumer whenever
that's the next thing wanted.
