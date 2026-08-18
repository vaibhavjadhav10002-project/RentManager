'use client'
import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/push'

export default function PWARegister() {
  useEffect(() => {
    // Deferred to the window 'load' event (fires after all critical
    // resources — including whatever data-fetch the destination page
    // itself kicked off in its own useEffect — have already gone out),
    // not run immediately on mount. registerServiceWorker() isn't part of
    // rendering anything the user sees; running it in the very first burst
    // of activity on launch just makes it compete for the same network/CPU
    // slot as the page's actual data. If the page loaded so fast that
    // 'load' already fired before this listener attaches, registering
    // immediately is correct (there's nothing left to compete with).
    if (document.readyState === 'complete') {
      registerServiceWorker()
    } else {
      window.addEventListener('load', () => registerServiceWorker(), { once: true })
    }
  }, [])
  return null
}
