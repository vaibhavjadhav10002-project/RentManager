'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full bg-tenant-surface border border-tenant-border rounded-tenant-lg text-[15px] text-tenant-fg placeholder:text-tenant-muted-subtle transition-colors focus:outline-none focus:border-tenant-primary focus:ring-2 focus:ring-tenant-primary/20 disabled:opacity-50'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, id, ...props }, ref) => {
    const inputId = id ?? props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-tenant-muted mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tenant-muted [&_svg]:h-4 [&_svg]:w-4">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              fieldBase,
              'h-12 px-3.5',
              leftIcon && 'pl-10',
              error && 'border-tenant-danger focus:border-tenant-danger focus:ring-tenant-danger/20',
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-tenant-danger mt-1.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-tenant-muted-subtle mt-1.5">{hint}</p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const areaId = id ?? props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={areaId} className="block text-xs font-semibold text-tenant-muted mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(fieldBase, 'px-3.5 py-3 resize-none', error && 'border-tenant-danger', className)}
          {...props}
        />
        {error ? (
          <p className="text-xs text-tenant-danger mt-1.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-tenant-muted-subtle mt-1.5">{hint}</p>
        ) : null}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
