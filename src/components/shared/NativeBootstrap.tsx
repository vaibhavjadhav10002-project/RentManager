'use client'
import { useEffect } from 'react'
import { bootstrapNative } from '@/lib/native/bootstrap'

export default function NativeBootstrap() {
  useEffect(() => {
    bootstrapNative()
  }, [])
  return null
}
