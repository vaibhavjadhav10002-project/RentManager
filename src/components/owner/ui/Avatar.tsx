'use client'

import { cn } from '@/lib/utils'

export interface OwnerAvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
}

export function OwnerAvatar({ src, name, size = 'md', className }: OwnerAvatarProps) {
  const initials = (name || '?')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={cn('rounded-owner-full object-cover shrink-0', sizeMap[size], className)} />
  }

  return (
    <div
      className={cn(
        'rounded-owner-full bg-owner-primary/15 text-owner-primary font-bold flex items-center justify-center shrink-0',
        sizeMap[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
