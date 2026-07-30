'use client'
import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/push'

export default function PWARegister() {
  useEffect(() => {
    registerServiceWorker()
  }, [])
  return null
}
