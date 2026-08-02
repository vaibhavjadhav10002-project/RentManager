/**
 * Rentivo Experience Engine — Master Feature Flag
 * ─────────────────────────────────────────────────────────────────────────
 * ONE switch controls the entire engine. When disabled, `engine.ts` short-
 * circuits before evaluating any config source, date rule, or priority
 * logic and returns "no pack active" — meaning every existing screen keeps
 * rendering exactly as it does today, with zero functional or visual
 * difference. Nothing downstream needs its own "is this on" check; the
 * engine's own output already reflects the flag.
 *
 * Source of truth: `NEXT_PUBLIC_EXPERIENCE_ENGINE_ENABLED` env var.
 *   - Unset or any value other than the literal string "true" → disabled.
 *   - This defaults to OFF on purpose: shipping this code should never by
 *     itself change production behavior. Turning the engine on is a
 *     deliberate, explicit opt-in (env var flip + redeploy).
 *   - Prefixed `NEXT_PUBLIC_` so it's readable both server- and client-side
 *     without extra plumbing, consistent with how this project already
 *     exposes public config (see `.env.local.example`).
 *
 * `isExperienceEngineEnabled()` also accepts an optional override, purely
 * so tests (and, later, a possible in-app admin "preview" toggle) don't
 * have to mutate `process.env` to exercise both branches.
 *
 * Remote-config note: whether the engine is *enabled* and what packs it
 * evaluates are deliberately separate concerns. This flag only answers
 * "should the engine run at all". Once a remote config source exists
 * (Phase 2+), it can still be entirely bypassed by this flag — a remote
 * outage or bad remote payload can never surface if the flag is off.
 */

export type ExperienceEngineFlagOverride = boolean | undefined

export function isExperienceEngineEnabled(override?: ExperienceEngineFlagOverride): boolean {
  if (typeof override === 'boolean') return override
  return process.env.NEXT_PUBLIC_EXPERIENCE_ENGINE_ENABLED === 'true'
}
