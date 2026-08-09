/**
 * Rentivo Experience Engine — Configuration Source Abstraction
 * ─────────────────────────────────────────────────────────────────────────
 * The engine never reads pack config directly from a file, an API, or a
 * database — it only ever asks something that implements
 * `ExperienceConfigSource` for "give me the current list of packs". This
 * means the origin of configuration can change later (local file → Supabase
 * table → Admin Panel API) without a single line of `engine.ts`,
 * `dateResolver.ts`, or `priorityResolver.ts` changing.
 *
 * Phase 1 ships exactly one implementation: `LocalConfigSource`, backed by
 * a plain in-memory array (see `localPacks.ts`). A future
 * `SupabaseConfigSource` or `RemoteConfigSource` (Phase 2+, not implemented
 * here) would implement this same interface — fetch rows from a
 * `experience_packs` table or an Admin Panel API, map them to
 * `ExperiencePack[]`, and be a drop-in replacement wherever
 * `ExperienceConfigSource` is used.
 */

import type { ExperiencePack } from './types'

export interface ExperienceConfigSource {
  /**
   * Returns the full current set of packs, enabled or not — filtering by
   * `enabled` and by date is the engine's job, not the source's. Async by
   * design even though `LocalConfigSource` resolves synchronously, so
   * every future source (network call, DB query) satisfies the same
   * contract without callers needing to know which kind they have.
   */
  getPacks(): Promise<ExperiencePack[]>
}

/**
 * Config source backed by a static, in-memory list of packs — Phase 1's
 * only source, and the one `localPacks.ts` is loaded through.
 */
export class LocalConfigSource implements ExperienceConfigSource {
  private readonly packs: ExperiencePack[]

  constructor(packs: ExperiencePack[]) {
    this.packs = packs
  }

  async getPacks(): Promise<ExperiencePack[]> {
    return this.packs
  }
}

/*
 * ── Forward-compatibility sketch (not implemented in Phase 1) ───────────
 *
 * export class SupabaseConfigSource implements ExperienceConfigSource {
 *   constructor(private client: SupabaseClient) {}
 *   async getPacks(): Promise<ExperiencePack[]> {
 *     const { data } = await this.client.from('experience_packs').select('*')
 *     return (data ?? []).map(mapRowToExperiencePack)
 *   }
 * }
 *
 * Swapping it in later is a one-line change wherever a config source is
 * constructed (e.g. in the root layout, once the engine is wired to the
 * UI) — `new LocalConfigSource(localPacks)` becomes
 * `new SupabaseConfigSource(supabase)`. Nothing else in the engine changes.
 */
