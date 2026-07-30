// The mock Supabase client lives outside React (it's constructed by
// src/lib/supabase/client.ts, the same factory function used everywhere
// today) so it can't call a React hook directly when a locked action is
// attempted. This tiny event bus is the bridge: the mock client emits,
// <ExploreLockSheet/> (mounted once in the root layout) listens.
type Listener = () => void
const listeners = new Set<Listener>()

export function onExploreLockRequested(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function requestExploreLock() {
  listeners.forEach(fn => fn())
}
