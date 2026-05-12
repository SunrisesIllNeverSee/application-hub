-- ============================================================
-- Migration 008: Intelligence Layer v2
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- This migration fills the gaps between the v3 schema design
-- and the MCP server's runtime requirements. Specifically:
--
--   1. ADD columns to programs (deadline_at, equity_pct, etc.)
--   2. ADD columns to archived_questions (significance_score, etc.)
--   3. ADD columns to profile_answers (question_text, theme, etc.)
--   4. ADD monthly_draft_limit to user_subscriptions view
--   5. CREATE program_dna table
--   6. CREATE user_program_fit table
--   7. CREATE match_archived_questions RPC (pgvector similarity)
--   8. CREATE increment_draft_count RPC
--   9. REWRITE ai_draft_runs (add program_id, archived_question_id)
--  10. Daily cron: recompute significance scores + fit scores
--  11. RLS policies for new tables
-- ============================================================


-- ============================================================
-- 1. PROGRAMS — add MCP-required columns
-- The original programs table used check_size_min/max and
-- equity_taken. The MCP server uses flattened display columns:
-- deadline_at, equity_pct, cash_value_usd, etc.
-- ============================================================

-- Deadline alias (MCP reads deadline_at; schema uses closes_at)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ
  GENERATED ALWAYS AS (closes_at) STORED;

-- Equity as percentage (schema stores 0.0–1.0 in equity_taken)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS equity_pct FLOAT
  GENERATED ALWAYS AS (ROUND((equity_taken * 100)::NUMERIC, 2)::FLOAT) STORED;

-- Cash value shorthand (midpoint of check range for display)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS cash_value_usd BIGINT
  GENERATED ALWAYS AS (
    CASE
      WHEN check_size_min IS NOT NULL AND check_size_max IS NOT NULL
        THEN (check_size_min + check_size_max) / 2 / 100   -- cents → dollars
      WHEN check_size_max IS NOT NULL THEN check_size_max / 100
      WHEN check_size_min IS NOT NULL THEN check_size_min / 100
      ELSE NULL
    END
  ) STORED;

-- Credits (non-cash value — perks, AWS credits, etc.)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS credit_value_usd INT;

-- Computed value score: what you get vs what you give up
-- Seeded by admin; refined by cron after enough outcome data exists
ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_value_score FLOAT;

-- Network and brand sub-scores (components of program_value_score)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS network_score FLOAT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS brand_score FLOAT;

-- Follow-on funding rate (% of cohort that raise a next round)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS follow_on_rate_pct FLOAT;

-- Rolling vs cohort (cohort = specific batch deadline)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_rolling BOOLEAN NOT NULL DEFAULT FALSE;

-- Index on the new value score for rankings queries
CREATE INDEX IF NOT EXISTS idx_programs_value_score ON programs (program_value_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_programs_deadline_at ON programs (deadline_at ASC NULLS LAST) WHERE deadline_at IS NOT NULL;


-- ============================================================
-- 2. ARCHIVED QUESTIONS — add significance_score + avg columns
-- significance = asked_by_count × avg_word_limit_weight × theme_prestige × universal_bonus
-- Precomputed and stored; refreshed nightly by cron.
-- ============================================================

ALTER TABLE archived_questions ADD COLUMN IF NOT EXISTS significance_score FLOAT NOT NULL DEFAULT 0;
ALTER TABLE archived_questions ADD COLUMN IF NOT EXISTS avg_word_limit INT;   -- median word limit across all programs asking this
ALTER TABLE archived_questions ADD COLUMN IF NOT EXISTS theme_weight FLOAT;   -- prestige weight for this question's theme

-- Rename importance_score → keep both; significance_score is the MCP-facing name
-- (importance_score remains for backward compatibility with existing code)

CREATE INDEX IF NOT EXISTS idx_archived_questions_significance ON archived_questions (significance_score DESC);


-- ============================================================
-- 3. PROFILE ANSWERS — align column names with MCP usage
-- MCP reads: question_text, theme, answer_content
-- Schema has: content (no question_text or theme)
-- Solution: add the missing columns + populate via trigger
-- ============================================================

ALTER TABLE profile_answers ADD COLUMN IF NOT EXISTS question_text TEXT NOT NULL DEFAULT '';
ALTER TABLE profile_answers ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE profile_answers ADD COLUMN IF NOT EXISTS answer_content TEXT NOT NULL DEFAULT '';
ALTER TABLE profile_answers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Sync answer_content ↔ content so both work
CREATE OR REPLACE FUNCTION sync_profile_answer_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Keep answer_content and content in sync (write to either, read from either)
  IF TG_OP = 'INSERT' OR NEW.answer_content IS DISTINCT FROM OLD.answer_content THEN
    NEW.content := NEW.answer_content;
  ELSIF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.answer_content := NEW.content;
  END IF;

  -- Auto-populate question_text from archived_questions if blank
  IF NEW.question_text = '' AND NEW.archived_question_id IS NOT NULL THEN
    SELECT text INTO NEW.question_text
    FROM archived_questions
    WHERE id = NEW.archived_question_id;
  END IF;

  -- Auto-populate theme from archived_questions if blank
  IF NEW.theme IS NULL AND NEW.archived_question_id IS NOT NULL THEN
    SELECT theme INTO NEW.theme
    FROM archived_questions
    WHERE id = NEW.archived_question_id;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_profile_answer_columns_trigger ON profile_answers;
CREATE TRIGGER sync_profile_answer_columns_trigger
  BEFORE INSERT OR UPDATE ON profile_answers
  FOR EACH ROW EXECUTE FUNCTION sync_profile_answer_columns();

-- Backfill question_text and theme for any existing rows
UPDATE profile_answers pa
SET
  question_text = COALESCE(aq.text, ''),
  theme = aq.theme,
  answer_content = pa.content
FROM archived_questions aq
WHERE pa.archived_question_id = aq.id
  AND (pa.question_text = '' OR pa.theme IS NULL OR pa.answer_content = '');


-- ============================================================
-- 4. USER SUBSCRIPTIONS — add monthly_draft_limit view column
-- MCP calls: select("tier, monthly_draft_limit")
-- Simplest fix: add a generated column that mirrors the plan limit
-- ============================================================

ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS monthly_draft_limit INT;

-- Populate from subscription_plans
UPDATE user_subscriptions us
SET monthly_draft_limit = sp.ai_drafts_per_month
FROM subscription_plans sp
WHERE sp.tier = us.tier;

-- Keep in sync on tier change
CREATE OR REPLACE FUNCTION sync_draft_limit_on_tier_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    SELECT ai_drafts_per_month INTO NEW.monthly_draft_limit
    FROM subscription_plans
    WHERE tier = NEW.tier;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_draft_limit_trigger ON user_subscriptions;
CREATE TRIGGER sync_draft_limit_trigger
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_draft_limit_on_tier_change();

-- Also set on insert
CREATE OR REPLACE FUNCTION set_draft_limit_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  SELECT ai_drafts_per_month INTO NEW.monthly_draft_limit
  FROM subscription_plans
  WHERE tier = NEW.tier;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_draft_limit_on_insert_trigger ON user_subscriptions;
CREATE TRIGGER set_draft_limit_on_insert_trigger
  BEFORE INSERT ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_draft_limit_on_insert();


-- ============================================================
-- 5. AI DRAFT RUNS — extend to match MCP insert schema
-- Migration 003 created ai_draft_runs with application_answer_id.
-- MCP inserts with program_id + archived_question_id instead.
-- Add the missing columns; keep the old ones nullable.
-- ============================================================

ALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;
ALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS archived_question_id UUID REFERENCES archived_questions(id) ON DELETE SET NULL;
ALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS integration_type TEXT;     -- "claude" | "openai" | "custom_agent" | "mcp"
ALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS prompt_tokens INT;
ALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS completion_tokens INT;

-- Make application_answer_id nullable (MCP doesn't always have one)
ALTER TABLE ai_draft_runs ALTER COLUMN application_answer_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_draft_runs_program ON ai_draft_runs (program_id);
CREATE INDEX IF NOT EXISTS idx_ai_draft_runs_question ON ai_draft_runs (archived_question_id);


-- ============================================================
-- 6. PROGRAM DNA TABLE
-- Per-program theme weight breakdown. Answers "what does this
-- program actually care about?" vs its stated priorities.
-- Computed from question distribution + word limits + prestige.
-- One row per (program_id, theme) pair.
-- ============================================================

CREATE TABLE IF NOT EXISTS program_dna (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  theme           TEXT NOT NULL,             -- matches archived_questions.theme
  question_count  INT NOT NULL DEFAULT 0,   -- # of questions in this theme for this program
  word_limit_sum  INT NOT NULL DEFAULT 0,   -- total word capacity allocated to this theme
  weight_pct      FLOAT NOT NULL DEFAULT 0, -- % of program's total question weight this theme represents
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, theme)
);

CREATE INDEX IF NOT EXISTS idx_program_dna_program ON program_dna (program_id);
CREATE INDEX IF NOT EXISTS idx_program_dna_theme ON program_dna (program_id, theme);

-- RLS: public read (program DNA is visible to all)
ALTER TABLE program_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_dna_public_read"
  ON program_dna FOR SELECT USING (TRUE);

CREATE POLICY "program_dna_service_write"
  ON program_dna FOR ALL USING (auth.role() = 'service_role');


-- ============================================================
-- 7. USER PROGRAM FIT TABLE
-- Pre-computed fit scores per (user, program) pair.
-- Refreshed daily by cron for all open programs.
-- Four-component breakdown mirrors hub_get_fit_score tool.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_program_fit (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  -- Overall score (0–100)
  fit_score        FLOAT NOT NULL DEFAULT 0,
  -- Components (each 0–100, combined as weighted average)
  coverage_pct     FLOAT,   -- 40% weight: required questions answered
  theme_alignment  FLOAT,   -- 35% weight: user's strong themes vs program DNA
  criteria_match   FLOAT,   -- 15% weight: stage/sector/geo fit
  quality_signal   FLOAT,   -- 10% weight: answer length + confidence level
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_user_program_fit_user ON user_program_fit (user_id);
CREATE INDEX IF NOT EXISTS idx_user_program_fit_program ON user_program_fit (program_id);
CREATE INDEX IF NOT EXISTS idx_user_program_fit_score ON user_program_fit (user_id, fit_score DESC);

-- RLS: users see only their own fit scores
ALTER TABLE user_program_fit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_program_fit_owner_select"
  ON user_program_fit FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_program_fit_service_write"
  ON user_program_fit FOR ALL USING (auth.role() = 'service_role');


-- ============================================================
-- 8. match_archived_questions RPC
-- pgvector similarity search over archived_questions.embedding.
-- Called by hub_find_similar_questions with a pre-generated
-- embedding vector. Falls back to ilike in the tool layer.
--
-- Args:
--   query_embedding vector(1536)  — embedding of the search text
--   match_threshold float         — cosine similarity floor (e.g. 0.7)
--   match_count     int           — max results to return
-- Returns: id, text, theme, similarity
-- ============================================================

CREATE OR REPLACE FUNCTION match_archived_questions(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count     int   DEFAULT 10
)
RETURNS TABLE (
  id              UUID,
  text            TEXT,
  theme           TEXT,
  significance_score FLOAT,
  asked_by_count  INT,
  is_universal    BOOLEAN,
  similarity      FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    aq.id,
    aq.text,
    aq.theme,
    aq.significance_score,
    aq.asked_by_count,
    aq.is_universal,
    1 - (aq.embedding <=> query_embedding) AS similarity
  FROM archived_questions aq
  WHERE aq.embedding IS NOT NULL
    AND 1 - (aq.embedding <=> query_embedding) >= match_threshold
  ORDER BY aq.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ============================================================
-- 9. increment_draft_count RPC
-- Called by hub_log_draft_run to upsert the ai_usage row.
-- Using an RPC rather than direct insert prevents race conditions
-- on concurrent draft submissions.
--
-- Args:
--   p_user_id   uuid   — auth user id
--   p_month_year text  — "YYYY-MM" billing period key
-- ============================================================

CREATE OR REPLACE FUNCTION increment_draft_count(
  p_user_id    UUID,
  p_month_year TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO ai_usage (user_id, month_year, draft_count, updated_at)
  VALUES (p_user_id, p_month_year, 1, NOW())
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET
    draft_count = ai_usage.draft_count + 1,
    updated_at  = NOW();
END;
$$;


-- ============================================================
-- 10. SIGNIFICANCE SCORE COMPUTATION
-- Recomputed nightly. Formula:
--   significance = asked_by_count
--                × avg_word_limit_weight   (word_limit / 500, capped at 2)
--                × theme_prestige          (per-theme multiplier)
--                × universal_bonus         (1.5 if is_universal, else 1.0)
-- ============================================================

CREATE OR REPLACE FUNCTION compute_significance_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Theme prestige weights (hand-tuned; recalibrate after 30+ programs seeded)
  theme_prestige JSONB := '{
    "traction":    1.4,
    "team":        1.3,
    "vision":      1.2,
    "market":      1.1,
    "product":     1.1,
    "financials":  1.0,
    "impact":      1.0,
    "legal":       0.9,
    "other":       0.8
  }'::JSONB;
BEGIN
  UPDATE archived_questions aq
  SET
    -- Recompute avg_word_limit from program_questions
    avg_word_limit = sub.avg_wl,
    theme_weight   = (theme_prestige ->> aq.theme)::FLOAT,
    significance_score = ROUND((
      aq.asked_by_count
      * LEAST(COALESCE(sub.avg_wl, 250)::FLOAT / 250.0, 2.0)  -- word limit weight, capped at 2
      * COALESCE((theme_prestige ->> aq.theme)::FLOAT, 1.0)   -- theme prestige
      * CASE WHEN aq.is_universal THEN 1.5 ELSE 1.0 END       -- universal bonus
    )::NUMERIC, 1)::FLOAT,
    updated_at = NOW()
  FROM (
    SELECT
      archived_question_id,
      ROUND(AVG(COALESCE(word_limit, 250))::NUMERIC, 0)::INT AS avg_wl
    FROM program_questions
    GROUP BY archived_question_id
  ) sub
  WHERE aq.id = sub.archived_question_id;
END;
$$;


-- ============================================================
-- 11. PROGRAM DNA COMPUTATION
-- Recomputed nightly after significance scores are refreshed.
-- For each program, groups questions by theme, sums word limits,
-- and computes each theme's share of total question weight.
-- ============================================================

CREATE OR REPLACE FUNCTION compute_program_dna()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete stale DNA for all programs (re-insert fresh)
  DELETE FROM program_dna;

  INSERT INTO program_dna (program_id, theme, question_count, word_limit_sum, weight_pct, computed_at)
  SELECT
    pq.program_id,
    aq.theme,
    COUNT(*)                                                        AS question_count,
    SUM(COALESCE(pq.word_limit, 250))                               AS word_limit_sum,
    ROUND(
      (SUM(COALESCE(pq.word_limit, 250))::FLOAT
       / NULLIF(SUM(SUM(COALESCE(pq.word_limit, 250))) OVER (PARTITION BY pq.program_id), 0)
       * 100)::NUMERIC,
      1
    )::FLOAT                                                        AS weight_pct,
    NOW()                                                           AS computed_at
  FROM program_questions pq
  JOIN archived_questions aq ON aq.id = pq.archived_question_id
  GROUP BY pq.program_id, aq.theme;
END;
$$;


-- ============================================================
-- 12. FIT SCORE COMPUTATION
-- Recomputed daily for all (user, open program) pairs.
-- Writes into user_program_fit via upsert.
-- Called from cron or manually after a user updates answers.
--
-- Formula (simplified — calibrate after real data exists):
--   fit_score = (coverage_pct × 0.40)
--             + (theme_alignment × 0.35)
--             + (criteria_match × 0.15)
--             + (quality_signal × 0.10)
-- ============================================================

CREATE OR REPLACE FUNCTION compute_user_fit_scores(p_user_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    -- For each (user, open program) pair
    SELECT
      u.id                  AS user_id,
      p.id                  AS program_id,
      p.program_value_score AS pvs
    FROM auth.users u
    CROSS JOIN programs p
    WHERE p.status = 'open'
      AND (p_user_id IS NULL OR u.id = p_user_id)
  LOOP
    INSERT INTO user_program_fit (
      user_id, program_id,
      coverage_pct, theme_alignment, criteria_match, quality_signal,
      fit_score, computed_at
    )
    SELECT
      rec.user_id,
      rec.program_id,
      -- COVERAGE (40%): % of required questions the user has answered
      COALESCE(
        (
          SELECT ROUND(
            COUNT(pa.id)::FLOAT
            / NULLIF(COUNT(pq.id), 0)
            * 100
          )
          FROM program_questions pq
          LEFT JOIN profile_answers pa
            ON pa.user_id = rec.user_id
            AND pa.archived_question_id = pq.archived_question_id
            AND pa.answer_content != ''
          WHERE pq.program_id = rec.program_id
            AND pq.is_required = TRUE
        ), 0
      ) AS coverage_pct,

      -- THEME ALIGNMENT (35%): user's strongest themes vs program's DNA weights
      COALESCE(
        (
          SELECT ROUND(
            SUM(
              LEAST(
                COALESCE(pd.weight_pct, 0),
                (
                  SELECT COUNT(*) * 10   -- proxy: 10 pts per answer in this theme
                  FROM profile_answers pa2
                  WHERE pa2.user_id = rec.user_id
                    AND pa2.theme = pd.theme
                    AND pa2.answer_content != ''
                )
              )
            ) / NULLIF(SUM(pd.weight_pct), 0) * 100
          )
          FROM program_dna pd
          WHERE pd.program_id = rec.program_id
        ), 0
      ) AS theme_alignment,

      -- CRITERIA MATCH (15%): placeholder — 50 until geo/stage filtering implemented
      50.0 AS criteria_match,

      -- QUALITY SIGNAL (10%): % of answers at 'solid' or 'locked' confidence
      COALESCE(
        (
          SELECT ROUND(
            SUM(CASE WHEN pa.confidence IN ('solid', 'locked') THEN 1 ELSE 0 END)::FLOAT
            / NULLIF(COUNT(pa.id), 0)
            * 100
          )
          FROM program_questions pq
          JOIN profile_answers pa
            ON pa.user_id = rec.user_id
            AND pa.archived_question_id = pq.archived_question_id
          WHERE pq.program_id = rec.program_id
        ), 0
      ) AS quality_signal,

      -- FIT SCORE: weighted composite
      0 AS fit_score,  -- computed below via update
      NOW() AS computed_at

    ON CONFLICT (user_id, program_id) DO UPDATE
    SET
      coverage_pct    = EXCLUDED.coverage_pct,
      theme_alignment = EXCLUDED.theme_alignment,
      criteria_match  = EXCLUDED.criteria_match,
      quality_signal  = EXCLUDED.quality_signal,
      computed_at     = NOW();

    -- Update fit_score from components
    UPDATE user_program_fit
    SET fit_score = ROUND(
      (coverage_pct    * 0.40
       + theme_alignment * 0.35
       + criteria_match  * 0.15
       + quality_signal  * 0.10)::NUMERIC,
      1
    )::FLOAT
    WHERE user_id = rec.user_id
      AND program_id = rec.program_id;

  END LOOP;
END;
$$;


-- ============================================================
-- 13. CRON JOBS (Supabase pg_cron / Edge Function triggers)
-- Schedule nightly intelligence refresh.
-- Requires pg_cron extension (enabled in Supabase dashboard).
-- ============================================================

-- Enable pg_cron if not already (safe to run multiple times)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Nightly at 02:00 UTC: refresh significance scores
SELECT cron.schedule(
  'refresh-significance-scores',
  '0 2 * * *',
  $$SELECT compute_significance_scores();$$
) ON CONFLICT DO NOTHING;

-- Nightly at 02:30 UTC: refresh program DNA (after significance)
SELECT cron.schedule(
  'refresh-program-dna',
  '30 2 * * *',
  $$SELECT compute_program_dna();$$
) ON CONFLICT DO NOTHING;

-- Nightly at 03:00 UTC: recompute fit scores for all active users
SELECT cron.schedule(
  'refresh-fit-scores',
  '0 3 * * *',
  $$SELECT compute_user_fit_scores(NULL);$$
) ON CONFLICT DO NOTHING;

-- Every 6 hours: refresh heat scores (program_stats trending_score)
-- (heat score logic lives in the existing program_stats trigger from migration 003)
SELECT cron.schedule(
  'refresh-heat-scores',
  '0 */6 * * *',
  $$
    UPDATE program_stats ps
    SET
      trending_score = COALESCE(
        (
          SELECT COUNT(*) * 1.0
          FROM program_signals sig
          WHERE sig.program_id = ps.program_id
            AND sig.created_at > NOW() - INTERVAL '48 hours'
            AND sig.signal_type IN ('view', 'save', 'start')
        ), 0
      ),
      updated_at = NOW()
    FROM programs p
    WHERE p.id = ps.program_id AND p.status = 'open';

    UPDATE programs p
    SET heat_score = COALESCE(ps.trending_score, 0)
    FROM program_stats ps
    WHERE ps.program_id = p.id;
  $$
) ON CONFLICT DO NOTHING;


-- ============================================================
-- 14. BOOTSTRAP: run initial significance + DNA compute
-- Safe to run on a fresh or populated database.
-- ============================================================

SELECT compute_significance_scores();
SELECT compute_program_dna();
