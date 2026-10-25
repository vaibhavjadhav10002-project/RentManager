import { createBrowserClient } from '@supabase/ssr'
import { isExploreModeClient } from '@/lib/explore/cookies'
import { createExploreClient } from '@/lib/explore/mock-client'

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>

// Reuses a single client instance for the lifetime of the tab instead of
// constructing a brand-new one on every call — `createBrowserClient` does
// real work (parsing config, wiring up auth-state listeners, cookie
// handling), and this function is called 25+ places across the app, many
// of them inside handlers that fire on every user interaction (every
// approve/reject, every form submit), so the app was previously building
// dozens of redundant client instances per session.
//
// Cached *per explore-mode state*, not unconditionally: enterExploreMode()/
// exitExploreMode() flip a cookie and then do a client-side router.push
// (no full page reload), so a naive unconditional singleton would keep
// serving the wrong client type (real vs. mock) after switching modes
// mid-session. Re-checking the cheap cookie read on every call and only
// reusing the cached client when the mode hasn't changed keeps both the
// common case (fast) and the mode-switch edge case (correct) working.
let cachedClient: SupabaseBrowserClient | null = null
let cachedForExploreMode: boolean | null = null

export function createClient(): SupabaseBrowserClient {
  const exploring = isExploreModeClient()
  if (cachedClient && cachedForExploreMode === exploring) return cachedClient

  cachedClient = exploring
    ? (createExploreClient() as unknown as SupabaseBrowserClient)
    : createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
  cachedForExploreMode = exploring
  return cachedClient
}
