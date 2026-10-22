-- ============================================================
-- P0 local role-boundary harness: 01 live-baseline schema
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY.
-- Reconstruction of the production (betcyfbzsgusaghriptz) state AFTER
-- migrations 049-053 and BEFORE 054/055, taken on 2026-10-20 from
-- read-only catalog SELECTs (information_schema.columns, pg_policies,
-- pg_trigger, pg_proc, pg_constraint, aclexplode) plus migrations
-- 025, 051, 052.
--
-- Known, deliberate simplifications (none affect the RLS paths tested):
--   * archived_questions.embedding (vector) is jsonb here (no pgvector).
--   * programs.funder_id has no FK (funders table not needed).
--   * Tables not touched by 054/055 are omitted except the ones the
--     "legitimate write" tests exercise (profile_answers,
--     application_answers, user_applications).
-- ============================================================

-- enums (live labels)
CREATE TYPE program_source      AS ENUM ('seeded','community','funder','fundingcake','canonical');
CREATE TYPE program_type        AS ENUM ('grant','accel','vc','corp','uni','job','fellowship','other');
CREATE TYPE program_status      AS ENUM ('upcoming','open','closed','results');
CREATE TYPE response_type       AS ENUM ('text_short','text_long','multiple_choice','yes_no','number','url','file_upload','date');
CREATE TYPE opportunity_kind    AS ENUM ('accelerator','vc','grant','fellowship','job_fulltime','job_internship','job_contract','school_undergrad','school_grad','school_professional','other');
CREATE TYPE application_status  AS ENUM ('saved','drafting','submitted','accepted','rejected','waitlist');
CREATE TYPE answer_confidence   AS ENUM ('draft','solid','locked');

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- ---------- programs ----------
CREATE TABLE programs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  organization text NOT NULL,
  type program_type NOT NULL,
  status program_status NOT NULL DEFAULT 'upcoming',
  round text,
  opens_at timestamptz, closes_at timestamptz, results_at timestamptz,
  check_size_min bigint, check_size_max bigint, equity_taken double precision,
  geo_focus text[], industry_tags text[],
  description text, url text, logo_url text,
  source program_source NOT NULL DEFAULT 'seeded',
  funder_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  heat_score double precision NOT NULL DEFAULT 0,
  applicant_count integer NOT NULL DEFAULT 0,
  scrape_url text, last_scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- production (008): deadline_at is GENERATED ALWAYS AS (closes_at) STORED
  deadline_at timestamptz GENERATED ALWAYS AS (closes_at) STORED, equity_pct double precision,
  cash_value_usd bigint, credit_value_usd integer,
  program_value_score double precision, network_score double precision,
  brand_score double precision, follow_on_rate_pct double precision,
  is_rolling boolean NOT NULL DEFAULT false,
  tldr text, pros text[], cons text[], best_for text,
  cohort_name text, program_start_date timestamptz, cohort_size integer,
  domain text NOT NULL DEFAULT 'founder'
    CONSTRAINT programs_domain_check CHECK (domain = ANY (ARRAY['founder','jobs','education','grants','general'])),
  kind opportunity_kind,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  details_schema_version smallint NOT NULL DEFAULT 1,
  apply_url text, remote_ok boolean, location_city text, location_country char(2),
  cost_to_apply_cents integer, expected_reward_cents_min bigint, expected_reward_cents_max bigint,
  salary_min_cents bigint, salary_max_cents bigint, employment_type text, seniority text,
  visa_sponsorship boolean, degree_level text, program_length_months smallint,
  gre_required boolean, gmat_required boolean, tuition_cents bigint,
  funder_type text, match_required boolean, funding_amount_cents bigint, funder_id uuid,
  CONSTRAINT programs_kind_not_null_chk CHECK (kind IS NOT NULL)
);
CREATE TRIGGER set_updated_at_programs BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------- archived_questions ----------
CREATE TABLE archived_questions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  text text NOT NULL,
  theme text NOT NULL,
  subtheme text,
  response_type response_type NOT NULL DEFAULT 'text_long',
  typical_word_limit integer,
  asked_by_count integer NOT NULL DEFAULT 1,
  importance_score double precision NOT NULL DEFAULT 0.5,
  is_universal boolean NOT NULL DEFAULT false,
  example_programs text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  significance_score double precision NOT NULL DEFAULT 0,
  avg_word_limit integer, theme_weight double precision,
  domain text NOT NULL DEFAULT 'founder'
    CONSTRAINT archived_questions_domain_check CHECK (domain = ANY (ARRAY['founder','jobs','education','grants','general'])),
  universal_theme text,
  applicable_kinds opportunity_kind[] NOT NULL DEFAULT '{}',
  question_archetype text,
  embedding jsonb
);
CREATE TRIGGER set_updated_at_archived_questions BEFORE UPDATE ON archived_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------- program_questions ----------
CREATE TABLE program_questions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  archived_question_id uuid NOT NULL REFERENCES archived_questions(id) ON DELETE RESTRICT,
  asked_as text NOT NULL,
  word_limit integer, char_limit integer,
  is_required boolean NOT NULL DEFAULT true,
  section text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- live counter trigger functions: SECURITY INVOKER (as found in pg_proc)
CREATE OR REPLACE FUNCTION public.increment_asked_by_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE archived_questions SET asked_by_count=asked_by_count+1, updated_at=NOW() WHERE id=NEW.archived_question_id;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.decrement_asked_by_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE archived_questions SET asked_by_count=GREATEST(0,asked_by_count-1), updated_at=NOW() WHERE id=OLD.archived_question_id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER increment_asked_by_on_program_question_insert AFTER INSERT ON program_questions
  FOR EACH ROW EXECUTE FUNCTION increment_asked_by_count();
CREATE TRIGGER decrement_asked_by_on_program_question_delete AFTER DELETE ON program_questions
  FOR EACH ROW EXECUTE FUNCTION decrement_asked_by_count();

-- ---------- user_applications ----------
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'team' CHECK (plan IN ('team','enterprise')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  invited_by uuid REFERENCES auth.users(id),
  joined_at timestamptz,
  invited_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);
CREATE TABLE team_invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  role text NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, email)
);
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE user_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'saved',
  started_at timestamptz, submitted_at timestamptz, result_at timestamptz,
  is_public_result boolean NOT NULL DEFAULT false,
  notes text,
  completion_pct double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  outcome_notes text, interview_date timestamptz, program_feedback text,
  would_recommend integer CHECK (would_recommend >= 1 AND would_recommend <= 5),
  outcome_logged_at timestamptz,
  UNIQUE (user_id, program_id)
);
CREATE TRIGGER set_updated_at_user_applications BEFORE UPDATE ON user_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------- personal answers (legit-write tests) ----------
CREATE TABLE profile_answers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archived_question_id uuid NOT NULL REFERENCES archived_questions(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  confidence answer_confidence NOT NULL DEFAULT 'draft',
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  question_text text NOT NULL DEFAULT '',
  theme text,
  answer_content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, archived_question_id)
);
CREATE TABLE application_answers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES user_applications(id) ON DELETE CASCADE,
  program_question_id uuid NOT NULL REFERENCES program_questions(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  sourced_from_profile boolean NOT NULL DEFAULT true,
  divergence_pct double precision,
  is_canonical boolean NOT NULL DEFAULT false,
  word_count integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_question_id)
);

-- migration 051 local-first write boundary (flag OFF in this fixture)
CREATE TABLE _deploy_flags (key text PRIMARY KEY, value text);
CREATE OR REPLACE FUNCTION local_first_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM _deploy_flags WHERE key='local_first' AND value='1') $$;
DO $o$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profile_answers','application_answers'] LOOP
    EXECUTE format('CREATE POLICY local_first_deny_insert ON %I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT local_first_active())', t);
    EXECUTE format('CREATE POLICY local_first_deny_update ON %I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT local_first_active()) WITH CHECK (NOT local_first_active())', t);
    EXECUTE format('CREATE POLICY local_first_deny_delete ON %I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT local_first_active())', t);
  END LOOP;
END $o$;

-- ---------- RLS: enabled, not forced (live) ----------
ALTER TABLE programs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_applications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites        ENABLE ROW LEVEL SECURITY;

-- ---------- LIVE POLICIES (pg_policies, 2026-10-20), verbatim ----------
-- programs
CREATE POLICY programs_auth_insert ON programs FOR INSERT
  WITH CHECK ((auth.role() = 'authenticated'::text) AND ((source IS NULL) OR (source <> 'canonical'::program_source)));
CREATE POLICY programs_canonical_read ON programs FOR SELECT
  USING ((source = 'canonical'::program_source) OR ((auth.role() = 'authenticated'::text) AND (EXISTS (
    SELECT 1 FROM user_applications ua WHERE ((ua.program_id = programs.id) AND (ua.user_id = auth.uid()))))));
CREATE POLICY programs_owner_or_admin_update ON programs FOR UPDATE
  USING ((funder_user_id = auth.uid()) OR (auth.role() = 'service_role'::text));
-- program_questions
CREATE POLICY program_questions_auth_insert ON program_questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM programs p WHERE ((p.id = program_questions.program_id) AND ((p.funder_user_id = auth.uid()) OR (auth.role() = 'service_role'::text)))));
CREATE POLICY program_questions_auth_update ON program_questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM programs p WHERE ((p.id = program_questions.program_id) AND ((p.funder_user_id = auth.uid()) OR (auth.role() = 'service_role'::text)))));
CREATE POLICY program_questions_visible_program_read ON program_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM programs p WHERE ((p.id = program_questions.program_id) AND ((p.source = 'canonical'::program_source) OR ((auth.role() = 'authenticated'::text) AND (EXISTS (
    SELECT 1 FROM user_applications ua WHERE ((ua.program_id = p.id) AND (ua.user_id = auth.uid())))))))));
-- archived_questions
CREATE POLICY archived_questions_admin_insert ON archived_questions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated'::text);
CREATE POLICY archived_questions_admin_update ON archived_questions FOR UPDATE
  USING (auth.role() = 'authenticated'::text);
CREATE POLICY archived_questions_visible_program_read ON archived_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM (program_questions pq JOIN programs p ON ((p.id = pq.program_id)))
    WHERE ((pq.archived_question_id = archived_questions.id) AND ((p.source = 'canonical'::program_source) OR ((auth.role() = 'authenticated'::text) AND (EXISTS (
      SELECT 1 FROM user_applications ua WHERE ((ua.program_id = p.id) AND (ua.user_id = auth.uid())))))))));
-- user_applications
CREATE POLICY user_applications_owner_delete ON user_applications FOR DELETE USING (user_id = auth.uid());
CREATE POLICY user_applications_owner_insert ON user_applications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY user_applications_owner_select ON user_applications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY user_applications_owner_update ON user_applications FOR UPDATE USING (user_id = auth.uid());
-- profile_answers / application_answers (owner policies)
CREATE POLICY profile_answers_owner_delete ON profile_answers FOR DELETE USING (user_id = auth.uid());
CREATE POLICY profile_answers_owner_insert ON profile_answers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_answers_owner_select ON profile_answers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY profile_answers_owner_update ON profile_answers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY application_answers_owner_delete ON application_answers FOR DELETE USING (user_id = auth.uid());
CREATE POLICY application_answers_owner_insert ON application_answers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY application_answers_owner_select ON application_answers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY application_answers_owner_update ON application_answers FOR UPDATE USING (user_id = auth.uid());
-- teams (migration 025 == live)
CREATE POLICY teams_member_select ON teams FOR SELECT USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY teams_owner_all ON teams FOR ALL USING (owner_id = auth.uid());
CREATE POLICY tm_member_select ON team_members FOR SELECT USING (team_id IN (SELECT team_id FROM team_members tm1 WHERE tm1.user_id = auth.uid()));
CREATE POLICY tm_owner_manage ON team_members FOR ALL USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));
CREATE POLICY ti_team_select ON team_invites FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY ti_owner_manage ON team_invites FOR ALL USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));
