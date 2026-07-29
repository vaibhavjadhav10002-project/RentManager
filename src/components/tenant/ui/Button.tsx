'use client'

import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-primary/40 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary:
          'bg-tenant-primary text-tenant-primary-fg shadow-tenant-glow hover:bg-tenant-primary-hover',
        secondary:
          'bg-tenant-surface-elevated text-tenant-fg border border-tenant-border hover:bg-tenant-surface-hover',
        outline:
          'bg-transparent text-tenant-fg border border-tenant-border-strong hover:bg-tenant-surface-hover',
        ghost:
          'bg-transparent text-tenant-fg hover:bg-tenant-surface-hover',
        destructive:
          'bg-tenant-danger text-white hover:bg-tenant-danger/90',
        link:
          'bg-transparent text-tenant-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3.5 text-xs rounded-tenant-lg',
        md: 'h-11 px-5 text-sm rounded-tenant-xl',
        lg: 'h-[3.25rem] px-6 text-[15px] rounded-tenant-xl',
        icon: 'h-11 w-11 rounded-tenant-xl',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, icon, iconPosition = 'left', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonStyles({ variant, size, fullWidth }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          icon && iconPosition === 'left' && icon
        )}
        {children}
        {!loading && icon && iconPosition === 'right' && icon}
      </button>
    )
  }
)
Button.displayName = 'Button'
