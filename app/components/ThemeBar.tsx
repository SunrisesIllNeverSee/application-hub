import type { QuestionTheme } from '@/lib/database.types'
import { themeLabel, cn } from '@/lib/utils'

interface ThemeBarProps {
  theme: QuestionTheme
  weight: number // 0–1
  questionCount?: number
}

const THEME_COLORS: Record<QuestionTheme, string> = {
  problem: 'bg-red-400',
  solution: 'bg-blue-400',
  market: 'bg-purple-400',
  traction: 'bg-green-400',
  team: 'bg-yellow-400',
  business_model: 'bg-orange-400',
  vision: 'bg-indigo-400',
  impact: 'bg-teal-400',
  technical: 'bg-cyan-400',
  fundraising: 'bg-pink-400',
  personal: 'bg-rose-400',
  fit: 'bg-sky-400',
}

export function ThemeBar({ theme, weight, questionCount }: ThemeBarProps) {
  const pct = Math.round(weight * 100)
  const barColor = THEME_COLORS[theme] ?? 'bg-neutral-400'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {themeLabel(theme)}
        </span>
        <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
          {questionCount != null && (
            <span>
              {questionCount}q
            </span>
          )}
          <span className="font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums">
            {pct}%
          </span>
        </div>
      </div>
      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
        <div
          className={cn('h-2 rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
