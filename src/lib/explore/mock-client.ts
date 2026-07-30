import { createMockPostgrestClient } from './mock-query-builder'
import { requestExploreLock } from './lock-bus'
import { EXPLORE_TABLES, EXPLORE_PROFILE } from './sample-data'

/**
 * A Supabase-client-shaped mock, used exclusively when Explore Mode is
 * active (see src/lib/supabase/client.ts). Every existing page and every
 * one of the ~120 functions in queries.ts calls `createClient()` and
 * then chains `.from(...)`, `.auth...`, `.storage...` on the result —
 * this object implements enough of that same shape that none of them
 * need to know Explore Mode exists. Reads serve the static seed dataset;
 * every write is intentionally locked (see mock-query-builder.ts).
 *
 * The store is never mutated (writes are locked, not applied), so there
 * is no reset logic to write — the data is simply always the original
 * seed, satisfying "refreshing restores the original sample data" by
 * construction rather than by explicitly clearing state on reload.
 */
export function createExploreClient() {
  const pg = createMockPostgrestClient(EXPLORE_TABLES)

  return {
    from: pg.from,
    rpc: pg.rpc,
    auth: {
      async getUser() {
        return { data: { user: { id: EXPLORE_PROFILE.id, email: EXPLORE_PROFILE.email } }, error: null }
      },
      async getSession() {
        return { data: { session: { user: { id: EXPLORE_PROFILE.id, email: EXPLORE_PROFILE.email } } }, error: null }
      },
      async signOut() {
        return { error: null }
      },
      onAuthStateChange() {
        // Explore Mode has no real session to change; return a no-op
        // subscription so any page that wires this up doesn't crash.
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
    storage: {
      from() {
        return {
          async upload() {
            requestExploreLock()
            return { data: null, error: { message: "You're exploring Rentivo — create a free account to upload files.", code: 'EXPLORE_LOCKED' } }
          },
          getPublicUrl() {
            return { data: { publicUrl: '' } }
          },
        }
      },
    },
  }
}
