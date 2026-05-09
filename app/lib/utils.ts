import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

export function formatEquity(pct: number | null | undefined): string {
  if (pct == null) return '—'
  return `${pct}%`
}

export function formatDeadline(dateStr: string | null | undefined): {
  label: string
  daysLeft: number | null
  urgent: boolean
} {
  if (!dateStr) return { label: 'Rolling', daysLeft: null, urgent: false }

  const deadline = new Date(dateStr)
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) return { label: 'Closed', daysLeft, urgent: false }
  if (daysLeft === 0) return { label: 'Closes today', daysLeft: 0, urgent: true }
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, daysLeft, urgent: true }
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, daysLeft, urgent: false }

  return {
    label: deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    daysLeft,
    urgent: false,
  }
}

export function countWords(text: string): number {
  if (!text.trim()) return 0
  return text.trim().split(/\s+/).length
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

export function programTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    accelerator: 'Accelerator',
    grant: 'Grant',
    fellowship: 'Fellowship',
    vc_fund: 'VC Fund',
    incubator: 'Incubator',
    studio: 'Studio',
  }
  return labels[type] ?? type
}

export function themeLabel(theme: string): string {
  const labels: Record<string, string> = {
    problem: 'Problem',
    solution: 'Solution',
    market: 'Market',
    traction: 'Traction',
    team: 'Team',
    business_model: 'Business Model',
    vision: 'Vision',
    impact: 'Impact',
    technical: 'Technical',
    fundraising: 'Fundraising',
    personal: 'Personal',
    fit: 'Fit',
  }
  return labels[theme] ?? theme
}
