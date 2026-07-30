'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OwnerCalendarMark {
  date: string // YYYY-MM-DD
  tone?: 'primary' | 'success' | 'warning' | 'danger'
}

const TONE_DOT = {
  primary: 'bg-owner-primary', success: 'bg-owner-success',
  warning: 'bg-owner-warning', danger: 'bg-owner-danger',
} as const

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function toKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

/**
 * A real, functional month calendar — not a mockup. Navigable, highlights
 * today. Renders no events by default: `markedDates` is empty until a
 * page has real event data to plot (lease expiries, move-in/move-out
 * dates, etc.). No fabricated dots or sample data are shown — an empty
 * calendar with working navigation is the honest baseline until that
 * data source exists.
 */
export function OwnerCalendar({ markedDates = [], onSelectDate, className }: {
  markedDates?: OwnerCalendarMark[]
  onSelectDate?: (date: Date) => void
  className?: string
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })

  const today = new Date()
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const marksByDate = new Map(markedDates.map(m => [m.date, m]))

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-owner-fg">
          {cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous month"
            onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded-owner-md text-owner-muted hover:bg-owner-surface-hover hover:text-owner-fg transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            aria-label="Next month"
            onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded-owner-md text-owner-muted hover:bg-owner-surface-hover hover:text-owner-fg transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-owner-muted-subtle py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />
          const isToday = toKey(date) === toKey(today)
          const mark = marksByDate.get(toKey(date))
          return (
            <button
              key={i}
              onClick={() => onSelectDate?.(date)}
              className={cn(
                'relative h-8 rounded-owner-md text-xs font-medium transition-colors flex items-center justify-center',
                isToday ? 'bg-owner-primary text-owner-primary-fg font-bold' : 'text-owner-fg hover:bg-owner-surface-hover'
              )}
            >
              {date.getDate()}
              {mark && !isToday && (
                <span className={cn('absolute bottom-1 w-1 h-1 rounded-full', TONE_DOT[mark.tone ?? 'primary'])} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
