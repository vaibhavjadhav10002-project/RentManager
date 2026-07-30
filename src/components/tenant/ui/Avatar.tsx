'use client'

import { cn } from '@/lib/utils'

export interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={cn('rounded-tenant-full object-cover shrink-0', sizeMap[size], className)} />
  }

  return (
    <div
      className={cn(
        'rounded-tenant-full bg-tenant-primary/15 text-tenant-primary font-bold flex items-center justify-center shrink-0',
        sizeMap[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
