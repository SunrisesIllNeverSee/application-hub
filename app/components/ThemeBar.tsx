import type { QuestionTheme } from '@/lib/database.types'
import { themeLabel, cn } from '@/lib/utils'

interface ThemeBarProps {
  theme: string
  /** Percentage value 0-100 as stored in program_dna.weight_pct */
  weight: number
  questionCount?: number
}

const THEME_COLORS: Partial<Record<QuestionTheme, string>> = {
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
  const pct = Math.max(0, Math.min(100, Math.round(weight)))
  const barColor = (THEME_COLORS as Record<string, string | undefined>)[theme] ?? 'bg-neutral-400'

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
      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
        <div
          className={cn('h-2 rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
