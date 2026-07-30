// Explore Mode is tracked with two plain, non-httpOnly cookies so both
// the server (middleware, layouts, for routing decisions) and the client
// (mock Supabase client, UI badge/lock-sheet) can read them without an
// extra round-trip. Neither cookie ever touches real auth state — a real
// Supabase session cookie always takes priority wherever both exist.
export const EXPLORE_COOKIE = 'rentivo_explore'
export const ONBOARDED_COOKIE = 'rentivo_onboarded'

export function isExploreModeClient(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some(c => c === `${EXPLORE_COOKIE}=1`)
}

export function enterExploreMode() {
  if (typeof document === 'undefined') return
  // 1 day — long enough for a session, short enough that a stale explorer
  // cookie doesn't linger forever on a shared/public device.
  document.cookie = `${EXPLORE_COOKIE}=1; path=/; max-age=${60 * 60 * 24}; samesite=lax`
  markOnboarded()
}

export function exitExploreMode() {
  if (typeof document === 'undefined') return
  document.cookie = `${EXPLORE_COOKIE}=; path=/; max-age=0`
}

export function markOnboarded() {
  if (typeof document === 'undefined') return
  document.cookie = `${ONBOARDED_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}
