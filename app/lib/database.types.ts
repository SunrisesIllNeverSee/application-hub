// Auto-reconciled against live Supabase schema (betcyfbzsgusaghriptz) — 2026-05-10
// Column names here MUST match the actual database columns exactly.

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ProgramType = 'grant' | 'accel' | 'vc' | 'corp' | 'uni' | 'job' | 'fellowship' | 'other'
export type ProgramStatus = 'upcoming' | 'open' | 'closed' | 'results'
export type QuestionTheme =
  | 'problem'
  | 'solution'
  | 'market'
  | 'traction'
  | 'team'
  | 'business_model'
  | 'vision'
  | 'impact'
  | 'technical'
  | 'fundraising'
  | 'personal'
  | 'fit'
export type AnswerSource = 'ai_generated' | 'human_written' | 'curated'
export type AnswerConfidence = 'draft' | 'solid' | 'locked'
export type SubscriptionTier = 'free' | 'pro' | 'team'

// ─── Core tables ──────────────────────────────────────────────────────────────

export interface Program {
  id: string
  slug: string
  name: string
  organization: string | null
  type: ProgramType
  status: ProgramStatus
  round: string | null
  opens_at: string | null
  closes_at: string | null
  results_at: string | null
  check_size_min: number | null   // stored in cents
  check_size_max: number | null   // stored in cents
  equity_taken: number | null     // as decimal e.g. 0.06 = 6%
  geo_focus: string[]
  industry_tags: string[]
  description: string | null
  url: string | null
  logo_url: string | null
  source: string | null
  funder_user_id: string | null
  parent_program_id: string | null
  heat_score: number
  applicant_count: number | null
  scrape_url: string | null
  last_scraped_at: string | null
  created_at: string
  updated_at: string
  // Computed columns (from migration 008)
  deadline_at: string | null
  equity_pct: number | null       // equity_taken * 100
  cash_value_usd: number | null   // check_size_max / 100
  credit_value_usd: number | null
  program_value_score: number | null
  network_score: number | null
  brand_score: number | null
  follow_on_rate_pct: number | null
  is_rolling: boolean
}

export interface ArchivedQuestion {
  id: string
  text: string                    // the canonical question text
  theme: QuestionTheme
  subtheme: string | null
  response_type: string | null
  typical_word_limit: number | null
  asked_by_count: number
  importance_score: number | null
  is_universal: boolean
  example_programs: string[]
  embedding: number[] | null
  created_at: string
  updated_at: string
  // Computed by compute_significance_scores()
  significance_score: number | null
  avg_word_limit: number | null
  theme_weight: number | null
}

export interface ProgramQuestion {
  id: string
  program_id: string
  archived_question_id: string
  asked_as: string                // exact phrasing used by this program
  word_limit: number | null
  char_limit: number | null
  is_required: boolean
  section: string | null          // NB: column is "section" not "section_name"
  order_index: number             // NB: column is "order_index" not "display_order"
  created_at: string
}

export interface ProfileAnswer {
  id: string
  user_id: string
  archived_question_id: string
  content: string
  word_count: number
  version: number | null
  confidence: AnswerConfidence | null  // NB: enum, not a float
  last_updated: string | null     // NB: column is "last_updated" not "updated_at"
  created_at: string
  // Denormalized columns (present in schema)
  question_text: string | null
  theme: string | null
  answer_content: string | null
  updated_at: string | null
}

export interface UserProgramFit {
  user_id: string
  program_id: string
  fit_score: number
  composite_score: number
  coverage_pct: number
  theme_alignment: number
  criteria_match: number
  quality_signal: number
  computed_at: string
}

export interface ProgramDna {
  id: string
  program_id: string
  theme: QuestionTheme
  weight_pct: number
  question_count: number
  avg_word_limit: number | null
  computed_at: string
}

export interface AiUsage {
  id: string
  user_id: string
  program_id: string | null
  archived_question_id: string | null
  tokens_used: number | null
  created_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  tier: SubscriptionTier
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

// ─── Joined / UI types ────────────────────────────────────────────────────────

export interface UserApplication {
  id: string
  user_id: string
  program_id: string
  status: 'saved' | 'drafting' | 'submitted' | 'accepted' | 'rejected' | 'waitlisted'
  submitted_at: string | null
  is_public_result: boolean
  created_at: string
  updated_at: string
}

export interface ProgramWithFit extends Program {
  fit?: UserProgramFit
  application?: UserApplication
}

export interface ProgramQuestionWithArchived extends ProgramQuestion {
  archived_question: ArchivedQuestion
}

export interface ProfileAnswerWithQuestion extends ProfileAnswer {
  archived_question: ArchivedQuestion
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format equity_taken (0.06) → "6%" or equity_pct (6) → "6%" */
export function formatEquityPct(val: number | null): string {
  if (val == null) return 'No equity'
  // If stored as decimal (0.06), multiply; if already pct (6), use directly
  const pct = val <= 1 ? val * 100 : val
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`
}

/** Format check_size in cents → "$150k" */
export function formatCheckSize(cents: number | null): string {
  if (cents == null) return '—'
  const usd = cents / 100
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}k`
  return `$${usd.toFixed(0)}`
}
