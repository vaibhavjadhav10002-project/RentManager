'use client'

import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

/**
 * Desktop/tablet table primitive. No horizontal scroll wrapper by design —
 * wrap usage in `<div className="hidden sm:block">` and provide a
 * `sm:hidden` stacked-card list with the same data for mobile. Every
 * current consumer (Rooms, Expenses, Tenants, Documents, Payments)
 * follows this pattern; keep new tables consistent with it rather than
 * re-adding overflow-x-auto here.
 */
export function OwnerTable({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full rounded-owner-xl border border-owner-border bg-owner-surface">
      <table className={cn('w-full text-sm border-collapse', className)} {...props} />
    </div>
  )
}

export function OwnerTableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-owner-bg-subtle', className)} {...props} />
}

export function OwnerTableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-owner-border', className)} {...props} />
}

export function OwnerTableRow({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn('transition-colors', interactive && 'hover:bg-owner-surface-hover cursor-pointer', className)}
      {...props}
    />
  )
}

export interface OwnerTableHeadCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean
  sortDirection?: 'asc' | 'desc' | null
  onSort?: () => void
}

export function OwnerTableHeadCell({ className, sortable, sortDirection, onSort, children, ...props }: OwnerTableHeadCellProps) {
  if (sortable) {
    return (
      <th className={cn('text-left px-4 py-3 text-xs font-bold text-owner-muted uppercase tracking-wide whitespace-nowrap', className)} {...props}>
        <button onClick={onSort} className="inline-flex items-center gap-1 hover:text-owner-fg transition-colors">
          {children}
          {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-40" />}
        </button>
      </th>
    )
  }
  return (
    <th className={cn('text-left px-4 py-3 text-xs font-bold text-owner-muted uppercase tracking-wide whitespace-nowrap', className)} {...props}>
      {children}
    </th>
  )
}

export function OwnerTableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3.5 text-owner-fg align-middle', className)} {...props} />
}

/** Spans the full table width — for empty/loading states inside a table body. */
export function OwnerTableEmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12">
        {children}
      </td>
    </tr>
  )
}
