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

/** Format check_size stored in cents → "$150k" */
export function formatCheckSize(cents: number | null | undefined): string {
  if (cents == null) return '—'
  const usd = cents / 100
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}k`
  return `$${usd.toFixed(0)}`
}

/** Format equity_taken decimal (0.06) → "6%" */
export function formatEquity(val: number | null | undefined): string {
  if (val == null) return '—'
  const pct = val <= 1 ? val * 100 : val
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`
}

export function formatDeadline(dateStr: string | null | undefined): {
  label: string
  daysLeft: number | null
  urgent: boolean
  status: 'rolling' | 'open' | 'closing_soon' | 'closed'
} {
  if (!dateStr) return { label: 'Rolling', daysLeft: null, urgent: false, status: 'rolling' }

  const deadline = new Date(dateStr)
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) return { label: 'Closed', daysLeft, urgent: false, status: 'closed' }
  if (daysLeft === 0) return { label: 'Closes today', daysLeft: 0, urgent: true, status: 'closing_soon' }
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, daysLeft, urgent: true, status: 'closing_soon' }
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, daysLeft, urgent: false, status: 'closing_soon' }

  return {
    label: `${daysLeft}d · ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    daysLeft,
    urgent: false,
    status: 'open',
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
    accel: 'Accelerator',
    grant: 'Grant',
    fellowship: 'Fellowship',
    vc: 'VC Fund',
    corp: 'Corporate',
    uni: 'University',
    job: 'Job',
    other: 'Other',
    // legacy aliases
    accelerator: 'Accelerator',
    vc_fund: 'VC Fund',
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

export function formatProgramStartDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function getHeatSignal(
  heatScore: number | null | undefined,
  programValueScore: number | null | undefined
): {
  label: string
  detail: string
  tone: 'neutral' | 'brand' | 'success'
  provisional: boolean
} {
  if (typeof heatScore === 'number' && heatScore > 0) {
    return {
      label: `${Math.round(heatScore)}/100`,
      detail: 'Live signal',
      tone: heatScore >= 70 ? 'success' : heatScore >= 45 ? 'brand' : 'neutral',
      provisional: false,
    }
  }

  if (typeof programValueScore === 'number') {
    if (programValueScore >= 80) {
      return { label: 'High potential', detail: 'Provisional', tone: 'success', provisional: true }
    }
    if (programValueScore >= 60) {
      return { label: 'Promising', detail: 'Provisional', tone: 'brand', provisional: true }
    }
  }

  return { label: 'Early signal', detail: 'Provisional', tone: 'neutral', provisional: true }
}

export function getApplicantSignal(
  applicantCount: number | null | undefined,
  cohortSize: number | null | undefined
): {
  label: string
  detail: string
  provisional: boolean
} {
  if (typeof applicantCount === 'number' && applicantCount > 0) {
    return { label: applicantCount.toLocaleString(), detail: 'Applicants', provisional: false }
  }

  if (typeof cohortSize === 'number' && cohortSize > 0) {
    return { label: `~${cohortSize} seats`, detail: 'Cohort size', provisional: true }
  }

  return { label: 'Unpublished', detail: 'Applicant volume', provisional: true }
}
