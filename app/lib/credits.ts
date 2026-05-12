// =============================================================================
// Credits & Achievements
// =============================================================================
// Single source of truth for event types, amounts, and achievement definitions.
// The DB triggers handle automatic awards (answers, submissions).
// The /api/credits/claim route handles manual claims (social actions).
// =============================================================================

export type CreditEventType =
  | 'social_twitter_follow'
  | 'social_linkedin_follow'
  | 'social_github_star'
  | 'social_share'
  | 'social_repost'
  | 'answer_first'
  | 'answer_25'
  | 'answer_100'
  | 'program_submit'
  | 'contribution_accepted'
  | 'profile_complete'
  | 'first_draft'

export interface CreditEventDef {
  type: CreditEventType
  amount: number
  label: string
  /** dedup strategy: 'once' = once per user ever, 'weekly' = once per ISO week */
  dedup: 'once' | 'weekly' | 'per_action'
  category: 'social' | 'app' | 'community'
  /** Whether the user manually claims this (vs auto-triggered by DB) */
  manual: boolean
  description: string
}

export const CREDIT_EVENTS: CreditEventDef[] = [
  // ── Social ──────────────────────────────────────────────────────────────────
  {
    type: 'social_twitter_follow',
    amount: 50,
    label: 'Follow on X / Twitter',
    dedup: 'once',
    category: 'social',
    manual: true,
    description: 'Follow @ApplicationHub on X',
  },
  {
    type: 'social_linkedin_follow',
    amount: 50,
    label: 'Follow on LinkedIn',
    dedup: 'once',
    category: 'social',
    manual: true,
    description: 'Follow Application Hub on LinkedIn',
  },
  {
    type: 'social_github_star',
    amount: 100,
    label: 'Star on GitHub',
    dedup: 'once',
    category: 'social',
    manual: true,
    description: 'Star the Application Hub repo on GitHub',
  },
  {
    type: 'social_share',
    amount: 25,
    label: 'Share on X / Twitter',
    dedup: 'weekly',
    category: 'social',
    manual: true,
    description: 'Share the pre-written post on X — earn 25 days of Pro, up to once per week',
  },
  {
    type: 'social_repost',
    amount: 25,
    label: 'Share on LinkedIn',
    dedup: 'weekly',
    category: 'social',
    manual: true,
    description: 'Share the pre-written post on LinkedIn — earn 25 days of Pro, up to once per week',
  },
  // ── App (auto-triggered by DB triggers) ────────────────────────────────────
  {
    type: 'answer_first',
    amount: 10,
    label: 'First answer',
    dedup: 'once',
    category: 'app',
    manual: false,
    description: 'Wrote your first answer',
  },
  {
    type: 'answer_25',
    amount: 50,
    label: '25 answers',
    dedup: 'once',
    category: 'app',
    manual: false,
    description: 'Built an arsenal of 25 answers',
  },
  {
    type: 'answer_100',
    amount: 150,
    label: '100 answers',
    dedup: 'once',
    category: 'app',
    manual: false,
    description: 'Complete arsenal — 100 answers',
  },
  {
    type: 'first_draft',
    amount: 20,
    label: 'First AI draft',
    dedup: 'once',
    category: 'app',
    manual: true,
    description: 'Used AI to draft your first answer',
  },
  {
    type: 'profile_complete',
    amount: 25,
    label: 'Complete profile',
    dedup: 'once',
    category: 'app',
    manual: true,
    description: 'Filled out your full profile',
  },
  // ── Community ──────────────────────────────────────────────────────────────
  {
    type: 'program_submit',
    amount: 25,
    label: 'Submit a program',
    dedup: 'per_action',
    category: 'community',
    manual: false,
    description: 'Submitted a program to the archive (auto-awarded on submit)',
  },
  {
    type: 'contribution_accepted',
    amount: 50,
    label: 'Contribution accepted',
    dedup: 'per_action',
    category: 'community',
    manual: false,
    description: 'Your submitted program was accepted into the archive',
  },
]

export const CREDIT_EVENT_MAP = Object.fromEntries(
  CREDIT_EVENTS.map(e => [e.type, e])
) as Record<CreditEventType, CreditEventDef>

// ── Achievements ──────────────────────────────────────────────────────────────

export interface AchievementDef {
  id: string
  label: string
  description: string
  icon: string
  category: 'writing' | 'community' | 'social' | 'milestones'
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_answer',     label: 'First Word',          description: 'Wrote your first answer',          icon: '✍️',  category: 'writing' },
  { id: 'answer_25',        label: 'Building Arsenal',    description: '25 questions answered',            icon: '🏗️',  category: 'writing' },
  { id: 'answer_100',       label: 'Arsenal Complete',    description: '100 questions answered',           icon: '⚡',  category: 'writing' },
  { id: 'first_draft',      label: 'AI Powered',          description: 'Used AI to draft an answer',       icon: '🤖',  category: 'writing' },
  { id: 'first_submission', label: 'Contributor',         description: 'Submitted a program',              icon: '📋',  category: 'community' },
  { id: 'accepted',         label: 'Verified Contributor', description: 'Had a submission accepted',       icon: '✅',  category: 'community' },
  { id: 'social_connected', label: 'Connected',           description: 'Followed us on social',            icon: '🔗',  category: 'social' },
  { id: 'profile_complete', label: 'Full Profile',        description: 'Completed your profile',           icon: '👤',  category: 'milestones' },
]

export const ACHIEVEMENT_MAP = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, a])
) as Record<string, AchievementDef>

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the ISO week dedup key for weekly-capped events */
export function weeklyDedupKey(eventType: CreditEventType): string {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getDay() + 1) / 7)
  return `${eventType}:${now.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Resolves the dedup_key for a given event type */
export function resolveDedupKey(eventType: CreditEventType, actionId?: string): string | null {
  const def = CREDIT_EVENT_MAP[eventType]
  if (!def) return null
  if (def.dedup === 'once') return eventType
  if (def.dedup === 'weekly') return weeklyDedupKey(eventType)
  if (def.dedup === 'per_action' && actionId) return `${eventType}:${actionId}`
  return null
}

// =============================================================================
// Pre-made share content
// =============================================================================
// Ready-to-go post text for each platform. Opening the share URL pre-fills
// the platform's compose window — the user just hits "Post" and earns credits.
// =============================================================================

export const SHARE_CONTENT = {
  twitter: {
    text: `I've been building my answer bank for YC, Techstars, and 30+ programs with @ApplicationHub. Answer once, apply everywhere — the question archive is genuinely useful. mos2es.xyz #founders #startups`,
    eventType: 'social_share' as CreditEventType,
    platformLabel: 'X / Twitter',
  },
  linkedin: {
    text: `Discovered a tool that changed how I approach accelerator applications. Application Hub archives every question across YC, Techstars, NSF, and 800+ programs — so you build one reusable answer bank instead of starting from scratch every time. Worth a look.`,
    url: 'https://mos2es.xyz',
    eventType: 'social_repost' as CreditEventType,
    platformLabel: 'LinkedIn',
  },
} as const

/**
 * Returns the share intent URL for a given platform.
 * Opening this URL in a new tab pre-fills the platform's compose window.
 */
export function getShareUrl(platform: 'twitter' | 'linkedin'): string {
  if (platform === 'twitter') {
    const text = encodeURIComponent(SHARE_CONTENT.twitter.text)
    return `https://twitter.com/intent/tweet?text=${text}`
  }
  const url = encodeURIComponent(SHARE_CONTENT.linkedin.url)
  const summary = encodeURIComponent(SHARE_CONTENT.linkedin.text)
  return `https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${summary}`
}
