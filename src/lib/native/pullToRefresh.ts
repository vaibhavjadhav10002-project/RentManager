'use client'
import { useEffect } from 'react'

/**
 * A page's PullToRefresh wrapper (in OwnerShell/AdminShell/Portal) has no
 * idea how any individual page fetches its own data — every page has its
 * own `load()`/`fetchData()` with a different name and signature. Rather
 * than threading a refresh callback through shell → layout → every page
 * as props (which would mean touching every page's component signature),
 * each page just registers its own reload function here on mount, and the
 * shell calls whatever is currently registered when the user pulls down.
 * Module-level, not React Context, because only one page is ever the
 * "current" pull target at a time — no need for provider nesting.
 */
let activeHandler: (() => void | Promise<void>) | null = null

export function usePullToRefreshHandler(handler: () => void | Promise<void>) {
  useEffect(() => {
    activeHandler = handler
    return () => { if (activeHandler === handler) activeHandler = null }
  }, [handler])
}

export async function triggerActiveRefresh() {
  if (activeHandler) await activeHandler()
}
