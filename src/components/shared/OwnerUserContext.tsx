'use client'
import { createContext, useContext } from 'react'

interface OwnerUser { name: string }
const Ctx = createContext<OwnerUser>({ name: '' })

export const OwnerUserProvider = Ctx.Provider
export function useOwnerUser() { return useContext(Ctx) }

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || ''
}
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'PG'
  return (parts[0][0] + (parts[1]?.[0] ?? parts[0][1] ?? '')).toUpperCase()
}
