'use client'

import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full bg-owner-surface border border-owner-border rounded-owner-lg text-sm text-owner-fg placeholder:text-owner-muted-subtle transition-colors focus:outline-none focus:border-owner-primary focus:ring-2 focus:ring-owner-primary/20 disabled:opacity-50'

export interface OwnerInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
}

export const OwnerInput = forwardRef<HTMLInputElement, OwnerInputProps>(
  ({ className, label, error, hint, leftIcon, id, ...props }, ref) => {
    const inputId = id ?? props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-owner-muted mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-owner-muted [&_svg]:h-3.5 [&_svg]:w-3.5">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              fieldBase,
              'h-9 px-3',
              leftIcon && 'pl-9',
              error && 'border-owner-danger focus:border-owner-danger focus:ring-owner-danger/20',
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-owner-danger mt-1.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-owner-muted-subtle mt-1.5">{hint}</p>
        ) : null}
      </div>
    )
  }
)
OwnerInput.displayName = 'OwnerInput'

export interface OwnerTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const OwnerTextarea = forwardRef<HTMLTextAreaElement, OwnerTextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const areaId = id ?? props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={areaId} className="block text-xs font-semibold text-owner-muted mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(fieldBase, 'px-3 py-2.5 resize-none', error && 'border-owner-danger', className)}
          {...props}
        />
        {error ? (
          <p className="text-xs text-owner-danger mt-1.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-owner-muted-subtle mt-1.5">{hint}</p>
        ) : null}
      </div>
    )
  }
)
OwnerTextarea.displayName = 'OwnerTextarea'

export interface OwnerSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
}

export const OwnerSelect = forwardRef<HTMLSelectElement, OwnerSelectProps>(
  ({ className, label, error, hint, id, children, ...props }, ref) => {
    const selectId = id ?? props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-owner-muted mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(fieldBase, 'h-9 pl-3 pr-8 appearance-none cursor-pointer', error && 'border-owner-danger', className)}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-owner-muted pointer-events-none" />
        </div>
        {error ? (
          <p className="text-xs text-owner-danger mt-1.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-owner-muted-subtle mt-1.5">{hint}</p>
        ) : null}
      </div>
    )
  }
)
OwnerSelect.displayName = 'OwnerSelect'
