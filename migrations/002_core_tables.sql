-- ============================================================
-- Migration 002: Core Tables
-- Application Hub Platform — Ello Cello LLC
-- ============================================================

-- ============================================================
-- ARCHIVED QUESTIONS
-- The platform's core asset. Every question ever asked by
-- any program is stored once here. Programs reference this
-- table rather than duplicating questions.
-- ============================================================

CREATE TABLE archived_questions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text                TEXT NOT NULL,
  theme               TEXT NOT NULL,                  -- e.g. "team", "traction", "vision", "financials"
  subtheme            TEXT,                           -- e.g. "co-founder relationship", "revenue model"
  response_type       response_type NOT NULL DEFAULT 'text_long',
  typical_word_limit  INT,                            -- median word limit across programs asking this
  asked_by_count      INT NOT NULL DEFAULT 1,         -- how many programs ask this question
  importance_score    FLOAT NOT NULL DEFAULT 0.5,     -- 0–1, derived from asked_by_count + program prestige
  is_universal        BOOLEAN NOT NULL DEFAULT FALSE, -- asked by 80%+ of programs → surfaces in profile onboarding
  example_programs    TEXT[] DEFAULT '{}',            -- display only, e.g. ['YC', 'Techstars']
  embedding           vector(1536),                   -- for semantic dedup + similarity search
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_archived_questions_theme ON archived_questions (theme);
CREATE INDEX idx_archived_questions_is_universal ON archived_questions (is_universal) WHERE is_universal = TRUE;
CREATE INDEX idx_archived_questions_asked_by_count ON archived_questions (asked_by_count DESC);
CREATE INDEX idx_archived_questions_text_trgm ON archived_questions USING gin (text gin_trgm_ops);
CREATE INDEX idx_archived_questions_embedding ON archived_questions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- PROGRAMS
-- Every program accepting applications: grants, accelerators,
-- VC, fellowships, universities, jobs. Versioned via
-- parent_program_id for round tracking (YC S25 → parent: YC S24).
-- ============================================================

CREATE TABLE programs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                TEXT UNIQUE NOT NULL,           -- e.g. "yc-s25", "techstars-boulder-2025"
  name                TEXT NOT NULL,
  organization        TEXT NOT NULL,
  type                program_type NOT NULL,
  status              program_status NOT NULL DEFAULT 'upcoming',
  round               TEXT,                           -- "S25", "Fall 2025", "Batch 18", etc.
  opens_at            TIMESTAMPTZ,
  closes_at           TIMESTAMPTZ,
  results_at          TIMESTAMPTZ,
  check_size_min      BIGINT,                         -- USD cents, nullable for non-funding programs
  check_size_max      BIGINT,
  equity_taken        FLOAT,                          -- 0.0–1.0, nullable
  geo_focus           TEXT[],                         -- ["US", "Global", "EU"]
  industry_tags       TEXT[],                         -- ["fintech", "health", "climate"]
  description         TEXT,
  url                 TEXT,
  logo_url            TEXT,
  source              program_source NOT NULL DEFAULT 'seeded',
  funder_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- if source = 'funder'
  parent_program_id   UUID REFERENCES programs(id) ON DELETE SET NULL,     -- prior round
  heat_score          FLOAT NOT NULL DEFAULT 0,       -- recomputed every 6 hours
  applicant_count     INT NOT NULL DEFAULT 0,         -- running counter
  scrape_url          TEXT,                           -- URL for agentic scraper to target
  last_scraped_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programs_status ON programs (status);
CREATE INDEX idx_programs_type ON programs (type);
CREATE INDEX idx_programs_closes_at ON programs (closes_at);
CREATE INDEX idx_programs_heat_score ON programs (heat_score DESC);
CREATE INDEX idx_programs_slug ON programs (slug);
CREATE INDEX idx_programs_industry_tags ON programs USING gin (industry_tags);
CREATE INDEX idx_programs_geo_focus ON programs USING gin (geo_focus);

-- ============================================================
-- PROGRAM QUESTIONS
-- Maps archived_questions to specific programs. Stores the
-- exact phrasing the program used, word limits, ordering.
-- ============================================================

CREATE TABLE program_questions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id            UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  archived_question_id  UUID NOT NULL REFERENCES archived_questions(id) ON DELETE RESTRICT,
  asked_as              TEXT NOT NULL,                -- exact phrasing from this program
  word_limit            INT,
  char_limit            INT,
  is_required           BOOLEAN NOT NULL DEFAULT TRUE,
  section               TEXT,                         -- "Team", "Product", "Financials"
  order_index           INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_program_questions_program ON program_questions (program_id);
CREATE INDEX idx_program_questions_archived ON program_questions (archived_question_id);
CREATE UNIQUE INDEX idx_program_questions_unique ON program_questions (program_id, archived_question_id);

-- ============================================================
-- PROFILE ANSWERS
-- A user's master answer bank. One row per user per archived
-- question. Word limits are unconstrained here — trimmed per
-- application when needed. This is what pre-fills applications
-- and surfaces as AI context when drafting.
-- ============================================================

CREATE TABLE profile_answers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archived_question_id  UUID NOT NULL REFERENCES archived_questions(id) ON DELETE CASCADE,
  content               TEXT NOT NULL DEFAULT '',
  word_count            INT NOT NULL DEFAULT 0,
  version               INT NOT NULL DEFAULT 1,
  confidence            answer_confidence NOT NULL DEFAULT 'draft',
  last_updated          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, archived_question_id)
);

CREATE INDEX idx_profile_answers_user ON profile_answers (user_id);
CREATE INDEX idx_profile_answers_question ON profile_answers (archived_question_id);
CREATE INDEX idx_profile_answers_confidence ON profile_answers (confidence);

-- ============================================================
-- PROFILE ANSWER HISTORY
-- Version history for profile answers. Written on every save.
-- ============================================================

CREATE TABLE profile_answer_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_answer_id UUID NOT NULL REFERENCES profile_answers(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  version           INT NOT NULL,
  word_count        INT NOT NULL DEFAULT 0,
  saved_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profile_answer_history_answer ON profile_answer_history (profile_answer_id);
CREATE INDEX idx_profile_answer_history_version ON profile_answer_history (profile_answer_id, version DESC);

-- ============================================================
-- USER APPLICATIONS
-- Per-user, per-program application state. Tracks lifecycle
-- from saved → submitted → accepted/rejected/waitlist.
-- ============================================================

CREATE TABLE user_applications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status          application_status NOT NULL DEFAULT 'saved',
  started_at      TIMESTAMPTZ,
  submitted_at    TIMESTAMPTZ,
  result_at       TIMESTAMPTZ,
  is_public_result BOOLEAN NOT NULL DEFAULT FALSE,   -- opt-in to share outcome for community stats
  notes           TEXT,
  completion_pct  FLOAT NOT NULL DEFAULT 0,          -- 0.0–1.0, recomputed on answer save
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, program_id)
);

CREATE INDEX idx_user_applications_user ON user_applications (user_id);
CREATE INDEX idx_user_applications_program ON user_applications (program_id);
CREATE INDEX idx_user_applications_status ON user_applications (status);

-- ============================================================
-- APPLICATION ANSWERS
-- Per-user, per-program-question answers. Pre-filled from
-- profile_answers on creation (sourced_from_profile = TRUE).
-- Users refine these per application. Past answers surface as
-- AI context when drafting — never auto-fill to new programs.
-- ============================================================

CREATE TABLE application_answers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id        UUID NOT NULL REFERENCES user_applications(id) ON DELETE CASCADE,
  program_question_id   UUID NOT NULL REFERENCES program_questions(id) ON DELETE CASCADE,
  content               TEXT NOT NULL DEFAULT '',
  sourced_from_profile  BOOLEAN NOT NULL DEFAULT TRUE,  -- was this pre-filled from profile?
  divergence_pct        FLOAT,                          -- % diff from profile answer (recomputed on save)
  is_canonical          BOOLEAN NOT NULL DEFAULT FALSE, -- user toggle: mark this as a keeper reference
  word_count            INT NOT NULL DEFAULT 0,
  version               INT NOT NULL DEFAULT 1,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, program_question_id)
);

CREATE INDEX idx_application_answers_user ON application_answers (user_id);
CREATE INDEX idx_application_answers_application ON application_answers (application_id);
CREATE INDEX idx_application_answers_program_question ON application_answers (program_question_id);
CREATE INDEX idx_application_answers_canonical ON application_answers (user_id, is_canonical) WHERE is_canonical = TRUE;
