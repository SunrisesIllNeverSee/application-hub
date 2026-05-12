-- ============================================================
-- Migration 003: Intelligence Layer, Integrations, and Import
-- Application Hub Platform — Ello Cello LLC
-- ============================================================

-- ============================================================
-- PROGRAM SIGNALS
-- Raw event stream for heat score computation.
-- view, save, start, submit — one row per event.
-- Aggregated every 6 hours into program_stats.
-- ============================================================

CREATE TABLE program_signals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  signal_type signal_type NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable for anonymous views
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_program_signals_program ON program_signals (program_id);
CREATE INDEX idx_program_signals_type ON program_signals (program_id, signal_type);
CREATE INDEX idx_program_signals_created ON program_signals (created_at DESC);
-- Partition hint: this table will grow fast — partition by month in production
CREATE INDEX idx_program_signals_recent ON program_signals (program_id, created_at DESC);

-- ============================================================
-- ACCEPTANCE REPORTS
-- Community-sourced outcome data. Users opt in (is_public_result
-- on user_applications) and their outcomes are aggregated here
-- for acceptance rate computation on programs.
-- ============================================================

CREATE TABLE acceptance_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id    UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  reported_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome       outcome_type NOT NULL,
  cohort_round  TEXT,                        -- "S25", "Fall 2025" — links to programs.round
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acceptance_reports_program ON acceptance_reports (program_id);
CREATE INDEX idx_acceptance_reports_outcome ON acceptance_reports (program_id, outcome);
CREATE UNIQUE INDEX idx_acceptance_reports_unique ON acceptance_reports (program_id, reported_by, cohort_round);

-- ============================================================
-- PROGRAM STATS
-- Live aggregate per program. Updated on each submission event
-- via trigger. Heat score recomputed by cron every 6 hours.
-- Single source of truth for the intelligence layer display.
-- ============================================================

CREATE TABLE program_stats (
  program_id            UUID PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE,
  application_count     INT NOT NULL DEFAULT 0,
  mean_score            FLOAT,                      -- mean curated score across submitted applications
  score_distribution    JSONB,                      -- {"1":n, "2":n, "3":n, "4":n, "5":n}
  acceptance_rate       FLOAT,                      -- derived from acceptance_reports
  last_submission_at    TIMESTAMPTZ,
  trending_score        FLOAT NOT NULL DEFAULT 0,   -- recent signal velocity (last 48h weighted)
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- IMPORT QUEUE
-- When users paste raw questions from a program not yet in
-- the system, those land here. AI maps them to archived_questions.
-- Validated before publishing.
-- ============================================================

CREATE TABLE import_queue (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_text              TEXT NOT NULL,
  program_id            UUID REFERENCES programs(id) ON DELETE SET NULL,
  submitted_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status                import_status NOT NULL DEFAULT 'pending',
  mapped_to             UUID REFERENCES archived_questions(id) ON DELETE SET NULL,
  confidence_score      FLOAT,                      -- AI confidence in mapping (0–1)
  reviewer_notes        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at           TIMESTAMPTZ
);

CREATE INDEX idx_import_queue_status ON import_queue (status);
CREATE INDEX idx_import_queue_program ON import_queue (program_id);

-- ============================================================
-- CONNECTED INTEGRATIONS
-- Per-user AI source connections. One default per user.
-- Config is encrypted via pgcrypto — never store keys plaintext.
-- ============================================================

CREATE TABLE connected_integrations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        integration_type NOT NULL,
  name        TEXT NOT NULL,                        -- user-defined label e.g. "My Claude Key"
  config      BYTEA,                                -- pgcrypto encrypted JSON: {api_key, model, endpoint}
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_connected_integrations_user ON connected_integrations (user_id);
-- Enforce one default per user
CREATE UNIQUE INDEX idx_connected_integrations_default ON connected_integrations (user_id) WHERE is_default = TRUE;

-- ============================================================
-- AI DRAFT RUNS
-- Every AI-generated draft for an application answer.
-- Scored on AI metrics (specificity, alignment, authenticity).
-- The user curates from these — the best curated version lives
-- in application_answers.content.
-- ============================================================

CREATE TABLE ai_draft_runs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_answer_id UUID NOT NULL REFERENCES application_answers(id) ON DELETE CASCADE,
  integration_id        UUID REFERENCES connected_integrations(id) ON DELETE SET NULL,
  prompt_used           TEXT,
  model_used            TEXT,
  output_content        TEXT NOT NULL,
  word_count            INT NOT NULL DEFAULT 0,
  -- AI scoring dimensions (0.0–1.0 each)
  score_specificity     FLOAT,
  score_alignment       FLOAT,
  score_authenticity    FLOAT,
  score_fluency         FLOAT,
  score_composite       FLOAT,                      -- weighted average, precomputed
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_draft_runs_answer ON ai_draft_runs (application_answer_id);
CREATE INDEX idx_ai_draft_runs_user ON ai_draft_runs (user_id);
CREATE INDEX idx_ai_draft_runs_created ON ai_draft_runs (created_at DESC);
