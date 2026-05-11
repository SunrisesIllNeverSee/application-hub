'use client'

import { cn } from '@/lib/utils'

const DNA_THEMES = [
  { key: 'team',            label: 'Team' },
  { key: 'traction',        label: 'Traction' },
  { key: 'problem',         label: 'Problem' },
  { key: 'solution',        label: 'Solution' },
  { key: 'market',          label: 'Market' },
  { key: 'vision',          label: 'Vision' },
  { key: 'business_model',  label: 'Business' },
  { key: 'impact',          label: 'Impact' },
] as const

type DnaKey = typeof DNA_THEMES[number]['key']

interface DnaData {
  theme: string
  weight: number
}

interface DnaRadarChartProps {
  dnaRows: DnaData[]
  userCoverage?: Partial<Record<DnaKey, number>>
  size?: number
  className?: string
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.sin(angleRad),
    y: cy - r * Math.cos(angleRad),
  }
}

function polygonPoints(cx: number, cy: number, r: number, count: number, values: number[]): string {
  return values
    .map((v, i) => {
      const angle = (2 * Math.PI * i) / count
      const pt = polarToCartesian(cx, cy, r * v, angle)
      return `${pt.x},${pt.y}`
    })
    .join(' ')
}

export function DnaRadarChart({ dnaRows, userCoverage, size = 220, className }: DnaRadarChartProps) {
  const themes = DNA_THEMES.filter(t =>
    dnaRows.some(d => d.theme === t.key && d.weight > 0)
  )

  if (themes.length === 0) return null

  const n = themes.length
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.36
  const labelR = size * 0.46

  // Max weight for normalization
  const maxWeight = Math.max(...themes.map(t => {
    const d = dnaRows.find(d => d.theme === t.key)
    return d?.weight ?? 0
  }), 1)

  const programValues = themes.map(t => {
    const d = dnaRows.find(d => d.theme === t.key)
    return Math.min(1, (d?.weight ?? 0) / maxWeight)
  })

  const coverageValues = userCoverage
    ? themes.map(t => Math.min(1, userCoverage[t.key as DnaKey] ?? 0))
    : null

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Grid rings */}
        {rings.map(ring => (
          <polygon
            key={ring}
            points={polygonPoints(cx, cy, r, n, Array(n).fill(ring))}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-neutral-200 dark:text-neutral-700"
          />
        ))}

        {/* Axis lines */}
        {themes.map((_, i) => {
          const angle = (2 * Math.PI * i) / n
          const outer = polarToCartesian(cx, cy, r, angle)
          return (
            <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y}
              stroke="currentColor" strokeWidth="0.5"
              className="text-neutral-200 dark:text-neutral-700" />
          )
        })}

        {/* Program DNA polygon */}
        <polygon
          points={polygonPoints(cx, cy, r, n, programValues)}
          fill="rgb(59 130 246 / 0.15)"
          stroke="rgb(59 130 246)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="dark:fill-blue-500/10 dark:stroke-blue-400"
        />

        {/* User coverage polygon */}
        {coverageValues && (
          <polygon
            points={polygonPoints(cx, cy, r, n, coverageValues)}
            fill="rgb(34 197 94 / 0.12)"
            stroke="rgb(34 197 94)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeDasharray="4 2"
            className="dark:fill-green-500/10 dark:stroke-green-400"
          />
        )}

        {/* Data dots — program */}
        {programValues.map((v, i) => {
          const angle = (2 * Math.PI * i) / n
          const pt = polarToCartesian(cx, cy, r * v, angle)
          return (
            <circle key={i} cx={pt.x} cy={pt.y} r="3"
              fill="rgb(59 130 246)" className="dark:fill-blue-400" />
          )
        })}

        {/* Labels */}
        {themes.map((t, i) => {
          const angle = (2 * Math.PI * i) / n
          const pt = polarToCartesian(cx, cy, labelR, angle)
          const align = Math.sin(angle) > 0.1 ? 'start'
            : Math.sin(angle) < -0.1 ? 'end' : 'middle'
          const pctRaw = dnaRows.find(d => d.theme === t.key)?.weight ?? 0
          return (
            <g key={t.key}>
              <text
                x={pt.x} y={pt.y}
                textAnchor={align}
                dominantBaseline="middle"
                fontSize="9"
                fontWeight="500"
                fill="currentColor"
                className="text-neutral-600 dark:text-neutral-400"
              >
                {t.label}
              </text>
              <text
                x={pt.x} y={pt.y + 9}
                textAnchor={align}
                dominantBaseline="middle"
                fontSize="8"
                fill="currentColor"
                className="text-neutral-400 dark:text-neutral-500"
              >
                {Math.round(pctRaw * 100)}%
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-500 dark:bg-blue-400 rounded-full inline-block" />
          Program DNA
        </span>
        {coverageValues && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-green-500 dark:bg-green-400 rounded-full inline-block" style={{ borderTop: '1px dashed' }} />
            Your coverage
          </span>
        )}
      </div>
    </div>
  )
}
