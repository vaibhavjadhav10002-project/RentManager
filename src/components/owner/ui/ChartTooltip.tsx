'use client'

/**
 * Custom tooltip content for Recharts charts, styled with owner-* tokens
 * instead of Recharts' plain-white default box (which looks jarring on a
 * dark dashboard). Pass as the `content` prop on any <Tooltip>:
 *
 *   <Tooltip content={<OwnerChartTooltip formatter={formatINR} />} />
 */
export function OwnerChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: { name: string; value: number; color?: string }[]
  label?: string
  formatter?: (value: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="bg-owner-surface-elevated border border-owner-border rounded-owner-lg shadow-owner-md px-3.5 py-2.5 text-xs">
      {label && <div className="font-bold text-owner-fg mb-1.5">{label}</div>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-owner-muted">{p.name}:</span>
            <span className="font-semibold text-owner-fg owner-numeric">
              {formatter ? formatter(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
