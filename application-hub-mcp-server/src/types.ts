export interface Program {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  deadline_at: string | null;
  equity_pct: number | null;
  cash_value_usd: number | null;
  credit_value_usd: number | null;
  heat_score: number | null;
  program_value_score: number | null;
  is_rolling: boolean;
  network_score: number | null;
  brand_score: number | null;
  description: string | null;
  url: string | null;
  follow_on_rate_pct: number | null;
}

export interface ProgramQuestion {
  id: string;
  archived_question_id: string | null;
  asked_as: string;
  theme: string | null;
  word_limit: number | null;
  char_limit: number | null;
  is_required: boolean;
  order_index: number;
  is_universal: boolean;
  asked_by_count: number;
}

export interface ArchivedQuestion {
  id: string;
  text: string;
  theme: string | null;
  significance_score: number | null;
  asked_by_count: number;
  avg_word_limit: number | null;
  is_universal: boolean;
}

export interface ProgramDna {
  theme: string;
  question_count: number;
  word_limit_sum: number;
  weight_pct: number;
}

export interface UserProgramFit {
  fit_score: number | null;
  coverage_pct: number | null;
  theme_alignment: number | null;
  criteria_match: number | null;
  quality_signal: number | null;
  computed_at: string;
}

export interface ProfileAnswer {
  question_text: string;
  theme: string | null;
  answer_content: string;
  confidence: string;
  word_count: number | null;
  last_updated: string;
}

export interface AcceptanceStats {
  acceptance_rate_pct: number | null;
  total_reports: number;
}
