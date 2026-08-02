/**
 * Rentivo Experience Engine — Immutability Utility
 * ─────────────────────────────────────────────────────────────────────────
 * Theme Packs are treated as immutable configuration, and the engine's
 * resolved output must be read-only — this guarantees the Website and
 * Android APK (both consuming the same engine later) can never observe a
 * pack that was mutated by one caller and leak that mutation to another,
 * and it makes the engine's behavior deterministic regardless of call
 * order.
 *
 * `freezeDeep` recursively `Object.freeze`s an object graph (plain objects
 * and arrays only — the shapes `ExperiencePack` and `ResolvedExperience`
 * are made of). It intentionally does NOT freeze class instances,
 * `Map`/`Set`, or other exotic objects; none of those appear in this
 * engine's data shapes, so keeping this simple is preferable to a
 * general-purpose deep-freeze library.
 */

export function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Object.isFrozen(value)) return value

  if (Array.isArray(value)) {
    value.forEach((item) => freezeDeep(item))
    return Object.freeze(value)
  }

  Object.values(value as object).forEach((v) => freezeDeep(v))
  return Object.freeze(value)
}
