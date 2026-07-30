'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { isExploreModeClient, exitExploreMode } from './cookies'

type ExploreContextValue = { isExploring: boolean; exit: () => void }
const ExploreContext = createContext<ExploreContextValue>({ isExploring: false, exit: () => {} })

export function ExploreModeProvider({ children }: { children: React.ReactNode }) {
  // Read on mount rather than during render — cookies aren't available
  // during SSR/hydration for a plain document.cookie check, and this
  // avoids a server/client markup mismatch.
  const [isExploring, setIsExploring] = useState(false)
  useEffect(() => { setIsExploring(isExploreModeClient()) }, [])

  const exit = () => { exitExploreMode(); setIsExploring(false) }

  return (
    <ExploreContext.Provider value={{ isExploring, exit }}>
      {children}
    </ExploreContext.Provider>
  )
}

export function useExploreMode() {
  return useContext(ExploreContext)
}
