'use client'

import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-owner-primary/40 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-owner-primary text-owner-primary-fg shadow-owner-xs hover:bg-owner-primary-hover',
        secondary: 'bg-owner-surface-elevated text-owner-fg border border-owner-border hover:bg-owner-surface-hover',
        outline: 'bg-transparent text-owner-fg border border-owner-border-strong hover:bg-owner-surface-hover',
        ghost: 'bg-transparent text-owner-fg hover:bg-owner-surface-hover',
        destructive: 'bg-owner-danger text-white hover:bg-owner-danger/90',
        link: 'bg-transparent text-owner-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-owner-md',
        md: 'h-9 px-4 text-sm rounded-owner-lg',
        lg: 'h-11 px-5 text-sm rounded-owner-lg',
        icon: 'h-9 w-9 rounded-owner-lg',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface OwnerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export const OwnerButton = forwardRef<HTMLButtonElement, OwnerButtonProps>(
  ({ className, variant, size, fullWidth, loading, icon, iconPosition = 'left', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonStyles({ variant, size, fullWidth }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon && iconPosition === 'left' && icon}
        {children}
        {!loading && icon && iconPosition === 'right' && icon}
      </button>
    )
  }
)
OwnerButton.displayName = 'OwnerButton'
