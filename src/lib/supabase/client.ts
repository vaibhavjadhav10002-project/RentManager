import { createBrowserClient } from '@supabase/ssr'
import { isExploreModeClient } from '@/lib/explore/cookies'
import { createExploreClient } from '@/lib/explore/mock-client'

export function createClient() {
  if (isExploreModeClient()) {
    return createExploreClient() as unknown as ReturnType<typeof createBrowserClient>
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
