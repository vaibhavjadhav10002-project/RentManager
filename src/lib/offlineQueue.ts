// A small, generic offline-action queue. Nothing like this existed in the codebase
// before this phase — "Offline Queue Improvements" implied a baseline to improve,
// but auditing turned up no queue, IndexedDB usage, or background-sync code
// anywhere. Rather than skip the phase, this builds a deliberately minimal,
// honestly-scoped primitive plus applies it to two representative flows
// (Visitor check-in, Parcel logging — both simple, idempotent-ish single inserts
// commonly done by on-site staff where wifi at a property entrance may be spotty)
// rather than retrofitting every mutation in the app.
//
// Storage is plain localStorage, not IndexedDB — the queue is small (a handful
// of pending actions at most between reconnects), and localStorage is simpler,
// synchronous, and available everywhere this is used (no service-worker access
// needed since this runs entirely on the page, not in the background).

export interface QueuedAction {
  id: string
  type: string
  payload: any
  queuedAt: string
  label: string // short human-readable description shown in the pending-sync UI
}

const STORAGE_KEY = 'pg-manager-offline-queue'
const CHANGE_EVENT = 'pg-manager-offline-queue-changed'

function readQueue(): QueuedAction[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function writeQueue(queue: QueuedAction[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function queueOfflineAction(type: string, payload: any, label: string): QueuedAction {
  const action: QueuedAction = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type, payload, label, queuedAt: new Date().toISOString(),
  }
  writeQueue([...readQueue(), action])
  return action
}

export function getQueuedActions(): QueuedAction[] {
  return readQueue()
}

export function subscribeToQueueChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

/** Attempts every queued action against the given executors (keyed by action
 * type). Succeeded actions are removed; failed ones stay queued for next time.
 * Never throws — a failed sync attempt should never surface as an app error,
 * since the whole point is "retry quietly later." */
export async function flushOfflineQueue(executors: Record<string, (payload: any) => Promise<void>>): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, failed: 0 }
  const queue = readQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  const remaining: QueuedAction[] = []
  let synced = 0, failed = 0
  for (const action of queue) {
    const executor = executors[action.type]
    if (!executor) { remaining.push(action); continue } // unknown type — keep it rather than silently drop it
    try {
      await executor(action.payload)
      synced++
    } catch {
      failed++
      remaining.push(action)
    }
  }
  writeQueue(remaining)
  return { synced, failed }
}
