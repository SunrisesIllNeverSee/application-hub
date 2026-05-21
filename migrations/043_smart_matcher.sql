-- =============================================================================
-- Migration 043: Smart Matcher — Program Embeddings + Recommendation RPC
-- =============================================================================
-- Purpose:
--   Add a program_embedding column to the programs table for semantic matching,
--   and create an RPC that computes personalized program recommendations by
--   comparing a user's persona_embedding against program embeddings.
--
-- Properties:
--   - ADDITIVE ONLY: adds a column and creates a function. No drops.
--   - IDEMPOTENT: uses IF NOT EXISTS guards where possible.
--   - NON-BREAKING: new column has no NOT NULL constraint.
-- =============================================================================

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- A. Add program_embedding column to programs table
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'program_embedding'
  ) THEN
    ALTER TABLE programs ADD COLUMN program_embedding VECTOR(1536);
  END IF;
END $$;

-- IVFFlat index for program embedding similarity search
CREATE INDEX IF NOT EXISTS idx_programs_embedding
  ON programs USING ivfflat (program_embedding vector_cosine_ops)
  WITH (lists = 100);

-- -----------------------------------------------------------------------------
-- B. Smart Matcher Recommendation RPC
-- -----------------------------------------------------------------------------
-- compute_smart_matcher_recommendations(p_user_id, p_modes, p_limit)
--
-- Returns: table of recommended programs with fit_score, top questions,
--          and answer previews, filtered by active modes and deadline.

CREATE OR REPLACE FUNCTION compute_smart_matcher_recommendations(
  p_user_id UUID,
  p_modes   TEXT[] DEFAULT '{}',
  p_limit   INT DEFAULT 20
)
RETURNS TABLE (
  program_id          UUID,
  program_name        TEXT,
  program_slug        TEXT,
  program_logo_url    TEXT,
  program_deadline    TIMESTAMPTZ,
  opportunity_kind    TEXT,
  fit_score           NUMERIC(5,4),
  top_questions       JSONB,
  user_answer_preview JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_persona_embedding VECTOR(1536);
BEGIN
  -- Get user's persona embedding from profiles table
  SELECT persona_embedding INTO v_persona_embedding
  FROM profiles
  WHERE user_id = p_user_id;

  -- If no persona embedding, return empty
  IF v_persona_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH scored_programs AS (
    SELECT
      p.id AS prog_id,
      p.name AS prog_name,
      p.slug AS prog_slug,
      p.logo_url AS prog_logo_url,
      p.deadline AS prog_deadline,
      p.opportunity_kind AS prog_opportunity_kind,
      -- Cosine similarity: 1 - cosine_distance
      1 - (p.program_embedding <=> v_persona_embedding) AS raw_fit_score
    FROM programs p
    WHERE p.program_embedding IS NOT NULL
      AND (
        array_length(p_modes, 1) IS NULL
        OR array_length(p_modes, 1) = 0
        OR p.opportunity_kind = ANY(p_modes)
      )
      AND (p.deadline IS NULL OR p.deadline > NOW())
    ORDER BY p.program_embedding <=> v_persona_embedding ASC
    LIMIT p_limit
  ),
  program_top_questions AS (
    SELECT
      sp.prog_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'question_id', aq.id,
            'text', aq.text,
            'theme', aq.theme,
            'significance_score', aq.significance_score
          )
          ORDER BY aq.significance_score DESC
        ) FILTER (WHERE aq.id IS NOT NULL),
        '[]'::JSONB
      ) AS questions
    FROM scored_programs sp
    LEFT JOIN program_questions pq ON pq.program_id = sp.prog_id
    LEFT JOIN archived_questions aq ON aq.id = pq.question_id
    GROUP BY sp.prog_id
  ),
  user_answers AS (
    SELECT
      sp.prog_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'question_id', pa.question_id,
            'answer_preview', LEFT(pa.content, 120),
            'confidence', pa.confidence
          )
        ) FILTER (WHERE pa.id IS NOT NULL),
        '[]'::JSONB
      ) AS answers
    FROM scored_programs sp
    LEFT JOIN program_questions pq ON pq.program_id = sp.prog_id
    LEFT JOIN profile_answers pa ON pa.question_id = pq.question_id AND pa.user_id = p_user_id
    GROUP BY sp.prog_id
  )
  SELECT
    sp.prog_id,
    sp.prog_name,
    sp.prog_slug,
    sp.prog_logo_url,
    sp.prog_deadline,
    sp.prog_opportunity_kind,
    ROUND(sp.raw_fit_score::NUMERIC, 4),
    ptq.questions,
    ua.answers
  FROM scored_programs sp
  LEFT JOIN program_top_questions ptq ON ptq.prog_id = sp.prog_id
  LEFT JOIN user_answers ua ON ua.prog_id = sp.prog_id
  ORDER BY sp.raw_fit_score DESC;
END;
$$;
