-- =============================================================================
-- Migration 042: Persona Profiles
-- =============================================================================
-- Purpose:
--   Introduce a persona profile system that enables rich, portable identity
--   representation for applicants. This is ADDITIVE and complements the existing
--   profile_answers table (which remains unchanged for the current answer bank).
--
--   Tables created:
--     - profiles: core persona identity with embedding and mode info
--     - persona_profile_answers: per-profile answer store with lineage tracking
--     - profile_persona_enrichments: AI-generated enrichments with governance
--
-- Properties:
--   - ADDITIVE ONLY: no DROP TABLE, no DROP COLUMN, no breaking type changes.
--   - IDEMPOTENT: every statement uses IF NOT EXISTS guards.
--   - NON-BREAKING: all new tables, no changes to existing tables.
-- =============================================================================

-- Ensure pgvector extension is available (already created in 001 but safe guard)
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- A. profiles — core persona identity
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commitment_hash   TEXT,
  provenance_chain  JSONB DEFAULT '[]'::JSONB,
  personal_info     JSONB DEFAULT '{}'::JSONB,
  persona_embedding VECTOR(1536),
  modes_enabled     TEXT[] DEFAULT '{}',
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Unique constraint: one persona profile per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- IVFFlat index for persona embedding similarity search
-- Note: requires at least some rows before building; will use sequential scan until then
CREATE INDEX IF NOT EXISTS idx_profiles_persona_embedding
  ON profiles USING ivfflat (persona_embedding vector_cosine_ops)
  WITH (lists = 50);

-- RLS policies for profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own ON profiles
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own ON profiles
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own ON profiles
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_delete_own'
  ) THEN
    CREATE POLICY profiles_delete_own ON profiles
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- B. persona_profile_answers — per-profile answers with lineage tracking
-- -----------------------------------------------------------------------------
-- This is separate from the existing profile_answers table which remains
-- unchanged for the current answer bank functionality.

CREATE TABLE IF NOT EXISTS persona_profile_answers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id       UUID NOT NULL REFERENCES archived_questions(id) ON DELETE CASCADE,
  answer_text       TEXT NOT NULL DEFAULT '',
  commitment_hash   TEXT,
  lineage_hash      TEXT,
  significance_score NUMERIC(4,3) DEFAULT 0,
  last_used_at      TIMESTAMPTZ,
  usage_count       INTEGER NOT NULL DEFAULT 0,
  applicable_modes  TEXT[] DEFAULT '{}',
  version           INTEGER NOT NULL DEFAULT 1,
  superseded_by     UUID REFERENCES persona_profile_answers(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE persona_profile_answers ENABLE ROW LEVEL SECURITY;

-- Index on profile_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_persona_profile_answers_profile_id
  ON persona_profile_answers(profile_id);

-- Index on question_id for cross-profile analytics
CREATE INDEX IF NOT EXISTS idx_persona_profile_answers_question_id
  ON persona_profile_answers(question_id);

-- Composite index for active (non-superseded) answers per profile
CREATE INDEX IF NOT EXISTS idx_persona_profile_answers_active
  ON persona_profile_answers(profile_id, question_id)
  WHERE superseded_by IS NULL;

-- RLS policies for persona_profile_answers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'persona_profile_answers' AND policyname = 'ppa_select_own'
  ) THEN
    CREATE POLICY ppa_select_own ON persona_profile_answers
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = persona_profile_answers.profile_id AND profiles.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'persona_profile_answers' AND policyname = 'ppa_insert_own'
  ) THEN
    CREATE POLICY ppa_insert_own ON persona_profile_answers
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = persona_profile_answers.profile_id AND profiles.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'persona_profile_answers' AND policyname = 'ppa_update_own'
  ) THEN
    CREATE POLICY ppa_update_own ON persona_profile_answers
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = persona_profile_answers.profile_id AND profiles.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'persona_profile_answers' AND policyname = 'ppa_delete_own'
  ) THEN
    CREATE POLICY ppa_delete_own ON persona_profile_answers
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = persona_profile_answers.profile_id AND profiles.user_id = auth.uid())
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- C. profile_persona_enrichments — AI-generated persona enrichments
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profile_persona_enrichments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrichment_type  TEXT NOT NULL,
  value            JSONB NOT NULL DEFAULT '{}'::JSONB,
  embedding        VECTOR(1536),
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_model     TEXT,
  governance_envelope JSONB DEFAULT '{}'::JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profile_persona_enrichments ENABLE ROW LEVEL SECURITY;

-- Index on profile_id for fast enrichment lookups
CREATE INDEX IF NOT EXISTS idx_profile_persona_enrichments_profile_id
  ON profile_persona_enrichments(profile_id);

-- Index on enrichment_type for type-specific queries
CREATE INDEX IF NOT EXISTS idx_profile_persona_enrichments_type
  ON profile_persona_enrichments(enrichment_type);

-- RLS policies for profile_persona_enrichments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profile_persona_enrichments' AND policyname = 'ppe_select_own'
  ) THEN
    CREATE POLICY ppe_select_own ON profile_persona_enrichments
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_persona_enrichments.profile_id AND profiles.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profile_persona_enrichments' AND policyname = 'ppe_insert_own'
  ) THEN
    CREATE POLICY ppe_insert_own ON profile_persona_enrichments
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_persona_enrichments.profile_id AND profiles.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profile_persona_enrichments' AND policyname = 'ppe_update_own'
  ) THEN
    CREATE POLICY ppe_update_own ON profile_persona_enrichments
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_persona_enrichments.profile_id AND profiles.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profile_persona_enrichments' AND policyname = 'ppe_delete_own'
  ) THEN
    CREATE POLICY ppe_delete_own ON profile_persona_enrichments
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_persona_enrichments.profile_id AND profiles.user_id = auth.uid())
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- D. Updated_at trigger for profiles and persona_profile_answers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_persona_profile_answers_updated_at'
  ) THEN
    CREATE TRIGGER trg_persona_profile_answers_updated_at
      BEFORE UPDATE ON persona_profile_answers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
