export type ProgramType = 'accelerator' | 'grant' | 'fellowship' | 'vc_fund' | 'incubator' | 'studio'
export type ApplicationType = 'cohort' | 'rolling' | 'invitation_only'
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
export type SubscriptionTier = 'free' | 'pro' | 'team'

export interface Program {
  id: string
  name: string
  slug: string
  type: ProgramType
  description: string | null
  website_url: string | null
  equity_taken: number | null
  equity_pct: number | null // generated column
  check_size_min: number | null
  check_size_max: number | null
  cash_value_usd: number | null // generated column
  cohort_size: number | null
  acceptance_rate: number | null
  application_type: ApplicationType
  closes_at: string | null
  deadline_at: string | null // generated column
  is_rolling: boolean
  tags: string[]
  location: string | null
  remote_ok: boolean
  heat_score: number
  value_score: number
  created_at: string
  updated_at: string
}

export interface ArchivedQuestion {
  id: string
  question_text: string
  normalized_text: string
  theme: QuestionTheme
  significance_score: number | null
  asked_by_count: number
  avg_word_limit: number | null
  is_universal: boolean
  embedding: number[] | null
  created_at: string
}

export interface ProgramQuestion {
  id: string
  program_id: string
  archived_question_id: string
  exact_phrasing: string
  word_limit: number | null
  char_limit: number | null
  is_required: boolean
  display_order: number
  section_name: string | null
}

export interface ProfileAnswer {
  id: string
  user_id: string
  archived_question_id: string
  content: string
  word_count: number
  source: AnswerSource
  confidence_score: number | null
  is_canonical: boolean
  created_at: string
  updated_at: string
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
  weight: number
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

// Joined types for UI use
export interface ProgramWithFit extends Program {
  fit?: UserProgramFit
}

export interface ProgramQuestionWithArchived extends ProgramQuestion {
  archived_question: ArchivedQuestion
}

export interface ProfileAnswerWithQuestion extends ProfileAnswer {
  archived_question: ArchivedQuestion
}
