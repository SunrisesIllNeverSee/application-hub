import type { QuestionTheme } from '@/lib/database.types'
import { themeLabel, cn } from '@/lib/utils'

interface ThemeTagProps {
  theme?: QuestionTheme | string | null
  size?: 'sm' | 'lg'
}

const THEME_STYLES: Record<string, string> = {
  problem: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  solution: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  market: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  traction: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  team: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  business_model: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  vision: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  impact: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  technical: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  fundraising: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  personal: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  fit: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
}

export function ThemeTag({ theme, size = 'sm' }: ThemeTagProps) {
  if (!theme) return null

  const style = THEME_STYLES[theme] ?? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
  const label = themeLabel(theme)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        style
      )}
    >
      {label}
    </span>
  )
}
