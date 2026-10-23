-- ============================================================
-- 061 — Bind user-scoped RPCs to the caller; least-privilege EXECUTE
--       on SECURITY DEFINER functions (M09)
-- ============================================================
-- STATUS: PREPARED — DO NOT APPLY without separate owner production
-- authorization. Apply as the postgres role (owner of the functions).
-- Idempotent (safe to re-run) and transactional. No table, view or
-- sequence is created or changed; only functions in public.
--
-- Bodies that are replaced were taken from production (2026-10-22,
-- read-only pg_get_functiondef); they match the repository chain apart
-- from comments and whitespace. Functions that only change grants or
-- search_path are ALTERed, so their bodies are not touched.
--
-- A. User-id functions, bound to the caller. A caller may pass only its
--    own id (auth.uid()), unless it is a server caller:
--      * service_role (JWT role claim: edge functions, MCP server), or
--      * a postgres / supabase_admin session that is not acting as an API
--        role (pg_cron, SQL editor, migrations), or
--      * seed_signup_questions only: the auth.users signup trigger
--        (pg_trigger_depth() > 0; the trigger runs in the auth service's
--        session, which is neither of the above).
--    Anything else raises 'forbidden' with SQLSTATE 42501. A NULL
--    p_user_id is a server-caller-only argument. The check uses
--    session_user and the JWT role, not current_user: inside a SECURITY
--    DEFINER function current_user is always the owner.
--      claim_starter_package(uuid)    041  DEFINER kept (writes
--                                          user_starter_claims, read-only
--                                          for authenticated in the W11 ideal)
--      run_daily_drip(uuid)           014  now SECURITY INVOKER: the caller's
--                                          grants and RLS cover it
--                                          (user_subscriptions owner select,
--                                          user_question_unlocks owner
--                                          insert/select, archived_questions
--                                          052 read policy), so it unlocks and
--                                          returns only readable questions.
--                                          RETURNING rewritten with qualified
--                                          columns: the unqualified theme
--                                          collided with the theme output
--                                          column (42702), which failed every
--                                          free-tier drip.
--      compute_user_fit_scores(uuid)  008  DEFINER kept (reads auth.users and
--                                          every user's profile_answers)
--      increment_draft_count(uuid,text) 008 DEFINER kept (ai_usage has no
--                                          authenticated write policy)
--      seed_signup_questions(uuid)    014  DEFINER kept (signup trigger)
-- B. Platform recompute jobs (no arguments): service_role and the owner
--    only. compute_heat_scores(), compute_program_dna(),
--    compute_significance_scores().
-- C. get_top_programs_by_value(...) (038): now SECURITY INVOKER and limited
--    to approved programs, the same rule as app/lib/canonical-catalog.ts
--    approvedProgramsFilter (registry slug OR source = 'canonical'). Its
--    one caller is the MCP server with service_role, which bypasses RLS,
--    so the filter is explicit rather than left to RLS.
-- D. Trigger functions: EXECUTE revoked from PUBLIC, anon, authenticated.
--    Firing a trigger does not check EXECUTE; trigger functions cannot be
--    called directly anyway.
-- E. Helpers called inside RLS policies / guard triggers as the caller:
--    local_first_active() (051 policies, TO authenticated) and
--    is_canonical_program(uuid) (054/058 SECURITY INVOKER guard triggers,
--    as the writing role). Kept for authenticated and service_role,
--    revoked from PUBLIC and anon (no anon policy or write path uses them).
-- search_path: every function replaced or ALTERed in A-C is pinned to
-- public, extensions, pg_temp (get_top_programs_by_value: public, pg_temp).
--
-- Callers found (2026-10-22: app, MCP server, edge functions in repo and
-- deployed, pg_cron, triggers, policies, other SQL functions):
--   claim_starter_package    app/api/onboarding/complete  authenticated, own id
--   run_daily_drip           /today, /dash, /questions     authenticated, own id
--   compute_user_fit_scores  pg_cron refresh-fit-scores    postgres, NULL
--   increment_draft_count    none (the MCP draft logger deliberately does not)
--   seed_signup_questions    trigger seed_questions_on_signup on auth.users
--   compute_program_dna      pg_cron refresh-program-dna   postgres
--   compute_significance_scores pg_cron refresh-significance-scores postgres
--   compute_heat_scores      none (owner / migrations only)
--   get_top_programs_by_value MCP hub_get_program_rankings service_role
--
-- EXECUTE after 061 (W11 rule: explicit grants in the same migration):
--   claim_starter_package, run_daily_drip      authenticated, service_role
--   local_first_active, is_canonical_program   authenticated, service_role
--   compute_user_fit_scores, increment_draft_count, seed_signup_questions,
--   compute_heat_scores, compute_program_dna, compute_significance_scores,
--   get_top_programs_by_value                  service_role
--   trigger functions                          service_role
-- No SECURITY DEFINER function in public is executable by anon
-- (supabase/tests/m09/60_rpc_caller_binding_tests.sql, RB-ANON-DEFINER).
--
-- ROLLBACK (restores the pre-061 definitions, search_path settings and
-- EXECUTE grants exactly, including the run_daily_drip 42702 error).
-- Run as postgres:
--   BEGIN;
--   CREATE OR REPLACE FUNCTION public.claim_starter_package(p_user_id uuid)
--    RETURNS integer
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public', 'extensions'
--   AS $function$
--   DECLARE
--     v_pack_id    UUID;
--     v_question_ids UUID[];
--     v_qid        UUID;
--     v_total      INTEGER := 0;
--   BEGIN
--     SELECT id, question_ids INTO v_pack_id, v_question_ids
--     FROM starter_packages WHERE name = 'Founder Starter Pack' AND is_active = TRUE LIMIT 1;
--
--     IF v_pack_id IS NULL THEN RETURN 0; END IF;
--
--     INSERT INTO user_starter_claims (user_id, starter_package_id)
--     VALUES (p_user_id, v_pack_id)
--     ON CONFLICT (user_id, starter_package_id) DO NOTHING;
--
--     FOREACH v_qid IN ARRAY v_question_ids LOOP
--       INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
--       VALUES (p_user_id, v_qid, 'starter')
--       ON CONFLICT (user_id, archived_question_id) DO NOTHING;
--       v_total := v_total + 1;
--     END LOOP;
--
--     RETURN v_total;
--   END;
--   $function$;
--   CREATE OR REPLACE FUNCTION public.run_daily_drip(p_user_id uuid)
--    RETURNS TABLE(question_id uuid, question_text text, theme text, significance double precision)
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public', 'extensions'
--   AS $function$
--   DECLARE
--     v_last_drip      TIMESTAMPTZ;
--     v_unlock_count   INT;
--     v_user_tier      TEXT;
--     v_free_cap       INT := 30;
--     v_drip_per_day   INT := 3;
--   BEGIN
--     SELECT tier::TEXT INTO v_user_tier FROM user_subscriptions WHERE user_id = p_user_id;
--     v_user_tier := COALESCE(v_user_tier, 'free');
--     IF v_user_tier IN ('pro', 'team') THEN
--       INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
--       SELECT p_user_id, aq.id, 'pro_unlock'
--       FROM archived_questions aq
--       WHERE aq.id NOT IN (SELECT archived_question_id FROM user_question_unlocks WHERE user_id = p_user_id)
--       ON CONFLICT DO NOTHING;
--       RETURN;
--     END IF;
--     SELECT MAX(unlocked_at) INTO v_last_drip
--     FROM user_question_unlocks WHERE user_id = p_user_id AND source = 'drip';
--     IF v_last_drip IS NOT NULL AND v_last_drip > NOW() - INTERVAL '20 hours' THEN RETURN; END IF;
--     SELECT COUNT(*) INTO v_unlock_count FROM user_question_unlocks WHERE user_id = p_user_id;
--     IF v_unlock_count >= v_free_cap THEN RETURN; END IF;
--     RETURN QUERY
--     INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
--     SELECT p_user_id, aq.id, 'drip'
--     FROM archived_questions aq
--     WHERE aq.id NOT IN (SELECT archived_question_id FROM user_question_unlocks WHERE user_id = p_user_id)
--     ORDER BY aq.significance_score DESC
--     LIMIT LEAST(v_drip_per_day, v_free_cap - v_unlock_count)
--     ON CONFLICT DO NOTHING
--     RETURNING
--       archived_question_id,
--       (SELECT text FROM archived_questions WHERE id = archived_question_id),
--       (SELECT theme FROM archived_questions WHERE id = archived_question_id),
--       (SELECT significance_score FROM archived_questions WHERE id = archived_question_id);
--   END;
--   $function$;
--   CREATE OR REPLACE FUNCTION public.compute_user_fit_scores(p_user_id uuid DEFAULT NULL::uuid)
--    RETURNS void
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--   AS $function$
--   DECLARE rec RECORD;
--   BEGIN
--     FOR rec IN
--       SELECT u.id AS user_id, p.id AS program_id, p.program_value_score AS pvs
--       FROM auth.users u CROSS JOIN programs p
--       WHERE p.status = 'open' AND (p_user_id IS NULL OR u.id = p_user_id)
--     LOOP
--       INSERT INTO user_program_fit (user_id, program_id, coverage_pct, theme_alignment, criteria_match, quality_signal, fit_score, computed_at)
--       SELECT
--         rec.user_id, rec.program_id,
--         COALESCE((
--           SELECT ROUND(COUNT(pa.id)::FLOAT / NULLIF(COUNT(pq.id), 0) * 100)
--           FROM program_questions pq
--           LEFT JOIN profile_answers pa ON pa.user_id = rec.user_id AND pa.archived_question_id = pq.archived_question_id AND pa.answer_content != ''
--           WHERE pq.program_id = rec.program_id AND pq.is_required = TRUE
--         ), 0) AS coverage_pct,
--         COALESCE((
--           SELECT ROUND(SUM(LEAST(COALESCE(pd.weight_pct, 0), (SELECT COUNT(*) * 10 FROM profile_answers pa2 WHERE pa2.user_id = rec.user_id AND pa2.theme = pd.theme AND pa2.answer_content != ''))) / NULLIF(SUM(pd.weight_pct), 0) * 100)
--           FROM program_dna pd WHERE pd.program_id = rec.program_id
--         ), 0) AS theme_alignment,
--         50.0 AS criteria_match,
--         COALESCE((
--           SELECT ROUND(SUM(CASE WHEN pa.confidence IN ('solid', 'locked') THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(pa.id), 0) * 100)
--           FROM program_questions pq JOIN profile_answers pa ON pa.user_id = rec.user_id AND pa.archived_question_id = pq.archived_question_id
--           WHERE pq.program_id = rec.program_id
--         ), 0) AS quality_signal,
--         0 AS fit_score, NOW() AS computed_at
--       ON CONFLICT (user_id, program_id) DO UPDATE SET
--         coverage_pct = EXCLUDED.coverage_pct, theme_alignment = EXCLUDED.theme_alignment,
--         criteria_match = EXCLUDED.criteria_match, quality_signal = EXCLUDED.quality_signal, computed_at = NOW();
--
--       UPDATE user_program_fit
--       SET fit_score = ROUND((coverage_pct * 0.40 + theme_alignment * 0.35 + criteria_match * 0.15 + quality_signal * 0.10)::NUMERIC, 1)::FLOAT
--       WHERE user_id = rec.user_id AND program_id = rec.program_id;
--     END LOOP;
--   END;
--   $function$;
--   CREATE OR REPLACE FUNCTION public.increment_draft_count(p_user_id uuid, p_month_year text)
--    RETURNS void
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--   AS $function$
--   BEGIN
--     INSERT INTO ai_usage (user_id, month_year, draft_count, updated_at)
--     VALUES (p_user_id, p_month_year, 1, NOW())
--     ON CONFLICT (user_id, month_year)
--     DO UPDATE SET draft_count = ai_usage.draft_count + 1, updated_at = NOW();
--   END;
--   $function$;
--   CREATE OR REPLACE FUNCTION public.seed_signup_questions(p_user_id uuid)
--    RETURNS integer
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public', 'extensions'
--   AS $function$
--   DECLARE
--     v_theme TEXT;
--     v_question_id UUID;
--     v_count INT := 0;
--     v_themes TEXT[] := ARRAY['team','traction','problem','solution','market','vision','personal','fit'];
--   BEGIN
--     FOREACH v_theme IN ARRAY v_themes LOOP
--       SELECT id INTO v_question_id
--       FROM archived_questions
--       WHERE theme = v_theme
--         AND id NOT IN (SELECT archived_question_id FROM user_question_unlocks WHERE user_id = p_user_id)
--       ORDER BY significance_score DESC
--       LIMIT 1;
--       IF v_question_id IS NOT NULL THEN
--         INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
--         VALUES (p_user_id, v_question_id, 'signup')
--         ON CONFLICT DO NOTHING;
--         v_count := v_count + 1;
--       END IF;
--     END LOOP;
--     RETURN v_count;
--   END;
--   $function$;
--   CREATE OR REPLACE FUNCTION public.get_top_programs_by_value(p_types program_type[] DEFAULT NULL::program_type[], p_domain text DEFAULT 'founder'::text, p_equity_max numeric DEFAULT NULL::numeric, p_status program_status[] DEFAULT ARRAY['open'::program_status], p_limit integer DEFAULT 20)
--    RETURNS TABLE(id uuid, name text, slug text, type program_type, domain text, status program_status, equity_pct numeric, cash_value_usd numeric, credit_value_usd numeric, program_value_score numeric, network_score numeric, brand_score numeric, follow_on_rate_pct numeric, heat_score numeric, is_rolling boolean, deadline_at timestamp with time zone)
--    LANGUAGE sql
--    STABLE SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--     SELECT
--       p.id,
--       p.name,
--       p.slug,
--       p.type,
--       p.domain,
--       p.status,
--       p.equity_pct,
--       p.cash_value_usd,
--       p.credit_value_usd,
--       p.program_value_score,
--       p.network_score,
--       p.brand_score,
--       p.follow_on_rate_pct,
--       p.heat_score,
--       p.is_rolling,
--       p.deadline_at
--     FROM programs p
--     WHERE
--       p.program_value_score IS NOT NULL
--       AND (p_types   IS NULL OR p.type   = ANY(p_types))
--       AND (p_domain  IS NULL OR p.domain = p_domain)
--       AND (p_status  IS NULL OR p.status = ANY(p_status))
--       AND (p_equity_max IS NULL OR p.equity_pct IS NULL OR p.equity_pct <= p_equity_max)
--     ORDER BY p.program_value_score DESC
--     LIMIT LEAST(p_limit, 100);
--   $function$;
--   ALTER FUNCTION public.compute_heat_scores() SET search_path = public, extensions;
--   ALTER FUNCTION public.compute_program_dna() RESET search_path;
--   ALTER FUNCTION public.compute_significance_scores() RESET search_path;
--   GRANT EXECUTE ON FUNCTION
--     public.claim_starter_package(uuid), public.run_daily_drip(uuid),
--     public.compute_user_fit_scores(uuid), public.increment_draft_count(uuid, text),
--     public.seed_signup_questions(uuid), public.compute_heat_scores(),
--     public.compute_program_dna(), public.compute_significance_scores(),
--     public.get_top_programs_by_value(program_type[], text, numeric, program_status[], integer),
--     public.local_first_active(), public.is_canonical_program(uuid),
--     public.auto_seed_questions_on_signup(), public.award_answer_credits(),
--     public.award_contribution_credits(), public.award_submission_credits(),
--     public.create_free_subscription_on_signup(), public.create_user_profile_on_signup(),
--     public.increment_asked_by_count(), public.decrement_asked_by_count(),
--     public.process_reward(), public.refresh_canonical_aggregate()
--   TO PUBLIC, anon, authenticated, service_role;
--   COMMIT;
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. claim_starter_package: SECURITY DEFINER, caller-bound
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_starter_package(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_pack_id    UUID;
  v_question_ids UUID[];
  v_qid        UUID;
  v_total      INTEGER := 0;
BEGIN
  -- caller binding (061)
  IF NOT (
       coalesce(auth.role(), '') = 'service_role'
    OR (session_user IN ('postgres', 'supabase_admin')
        AND coalesce(auth.role(), '') NOT IN ('anon', 'authenticated'))
    OR (coalesce(auth.role(), '') = 'authenticated'
        AND p_user_id IS NOT NULL AND p_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id, question_ids INTO v_pack_id, v_question_ids
  FROM starter_packages WHERE name = 'Founder Starter Pack' AND is_active = TRUE LIMIT 1;

  IF v_pack_id IS NULL THEN RETURN 0; END IF;

  INSERT INTO user_starter_claims (user_id, starter_package_id)
  VALUES (p_user_id, v_pack_id)
  ON CONFLICT (user_id, starter_package_id) DO NOTHING;

  FOREACH v_qid IN ARRAY v_question_ids LOOP
    INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
    VALUES (p_user_id, v_qid, 'starter')
    ON CONFLICT (user_id, archived_question_id) DO NOTHING;
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$function$;

-- ------------------------------------------------------------
-- 2. run_daily_drip: SECURITY INVOKER, caller-bound, qualified RETURNING
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_daily_drip(p_user_id uuid)
 RETURNS TABLE(question_id uuid, question_text text, theme text, significance double precision)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_last_drip      TIMESTAMPTZ;
  v_unlock_count   INT;
  v_user_tier      TEXT;
  v_free_cap       INT := 30;
  v_drip_per_day   INT := 3;
BEGIN
  -- caller binding (061)
  IF NOT (
       coalesce(auth.role(), '') = 'service_role'
    OR (session_user IN ('postgres', 'supabase_admin')
        AND coalesce(auth.role(), '') NOT IN ('anon', 'authenticated'))
    OR (coalesce(auth.role(), '') = 'authenticated'
        AND p_user_id IS NOT NULL AND p_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT us.tier::TEXT INTO v_user_tier FROM user_subscriptions us WHERE us.user_id = p_user_id;
  v_user_tier := COALESCE(v_user_tier, 'free');
  IF v_user_tier IN ('pro', 'team') THEN
    INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
    SELECT p_user_id, aq.id, 'pro_unlock'
    FROM archived_questions aq
    WHERE aq.id NOT IN (SELECT u.archived_question_id FROM user_question_unlocks u WHERE u.user_id = p_user_id)
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;
  SELECT MAX(u.unlocked_at) INTO v_last_drip
  FROM user_question_unlocks u WHERE u.user_id = p_user_id AND u.source = 'drip';
  IF v_last_drip IS NOT NULL AND v_last_drip > NOW() - INTERVAL '20 hours' THEN RETURN; END IF;
  SELECT COUNT(*) INTO v_unlock_count FROM user_question_unlocks u WHERE u.user_id = p_user_id;
  IF v_unlock_count >= v_free_cap THEN RETURN; END IF;
  RETURN QUERY
  WITH ins AS (
    INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
    SELECT p_user_id, aq.id, 'drip'
    FROM archived_questions aq
    WHERE aq.id NOT IN (SELECT u.archived_question_id FROM user_question_unlocks u WHERE u.user_id = p_user_id)
    ORDER BY aq.significance_score DESC
    LIMIT LEAST(v_drip_per_day, v_free_cap - v_unlock_count)
    ON CONFLICT DO NOTHING
    RETURNING user_question_unlocks.archived_question_id AS aq_id
  )
  SELECT aq.id, aq.text, aq.theme, aq.significance_score
  FROM ins JOIN archived_questions aq ON aq.id = ins.aq_id
  ORDER BY aq.significance_score DESC;
END;
$function$;

-- ------------------------------------------------------------
-- 3. compute_user_fit_scores: SECURITY DEFINER, caller-bound,
--    search_path pinned
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_user_fit_scores(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
DECLARE rec RECORD;
BEGIN
  -- caller binding (061); NULL (all users) is a server-caller-only argument
  IF NOT (
       coalesce(auth.role(), '') = 'service_role'
    OR (session_user IN ('postgres', 'supabase_admin')
        AND coalesce(auth.role(), '') NOT IN ('anon', 'authenticated'))
    OR (coalesce(auth.role(), '') = 'authenticated'
        AND p_user_id IS NOT NULL AND p_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR rec IN
    SELECT u.id AS user_id, p.id AS program_id, p.program_value_score AS pvs
    FROM auth.users u CROSS JOIN programs p
    WHERE p.status = 'open' AND (p_user_id IS NULL OR u.id = p_user_id)
  LOOP
    INSERT INTO user_program_fit (user_id, program_id, coverage_pct, theme_alignment, criteria_match, quality_signal, fit_score, computed_at)
    SELECT
      rec.user_id, rec.program_id,
      COALESCE((
        SELECT ROUND(COUNT(pa.id)::FLOAT / NULLIF(COUNT(pq.id), 0) * 100)
        FROM program_questions pq
        LEFT JOIN profile_answers pa ON pa.user_id = rec.user_id AND pa.archived_question_id = pq.archived_question_id AND pa.answer_content != ''
        WHERE pq.program_id = rec.program_id AND pq.is_required = TRUE
      ), 0) AS coverage_pct,
      COALESCE((
        SELECT ROUND(SUM(LEAST(COALESCE(pd.weight_pct, 0), (SELECT COUNT(*) * 10 FROM profile_answers pa2 WHERE pa2.user_id = rec.user_id AND pa2.theme = pd.theme AND pa2.answer_content != ''))) / NULLIF(SUM(pd.weight_pct), 0) * 100)
        FROM program_dna pd WHERE pd.program_id = rec.program_id
      ), 0) AS theme_alignment,
      50.0 AS criteria_match,
      COALESCE((
        SELECT ROUND(SUM(CASE WHEN pa.confidence IN ('solid', 'locked') THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(pa.id), 0) * 100)
        FROM program_questions pq JOIN profile_answers pa ON pa.user_id = rec.user_id AND pa.archived_question_id = pq.archived_question_id
        WHERE pq.program_id = rec.program_id
      ), 0) AS quality_signal,
      0 AS fit_score, NOW() AS computed_at
    ON CONFLICT (user_id, program_id) DO UPDATE SET
      coverage_pct = EXCLUDED.coverage_pct, theme_alignment = EXCLUDED.theme_alignment,
      criteria_match = EXCLUDED.criteria_match, quality_signal = EXCLUDED.quality_signal, computed_at = NOW();

    UPDATE user_program_fit
    SET fit_score = ROUND((coverage_pct * 0.40 + theme_alignment * 0.35 + criteria_match * 0.15 + quality_signal * 0.10)::NUMERIC, 1)::FLOAT
    WHERE user_id = rec.user_id AND program_id = rec.program_id;
  END LOOP;
END;
$function$;

-- ------------------------------------------------------------
-- 4. increment_draft_count: SECURITY DEFINER, caller-bound,
--    search_path pinned (it had none)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_draft_count(p_user_id uuid, p_month_year text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
BEGIN
  -- caller binding (061)
  IF NOT (
       coalesce(auth.role(), '') = 'service_role'
    OR (session_user IN ('postgres', 'supabase_admin')
        AND coalesce(auth.role(), '') NOT IN ('anon', 'authenticated'))
    OR (coalesce(auth.role(), '') = 'authenticated'
        AND p_user_id IS NOT NULL AND p_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO ai_usage (user_id, month_year, draft_count, updated_at)
  VALUES (p_user_id, p_month_year, 1, NOW())
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET draft_count = ai_usage.draft_count + 1, updated_at = NOW();
END;
$function$;

-- ------------------------------------------------------------
-- 5. seed_signup_questions: SECURITY DEFINER, caller-bound (plus the
--    signup trigger), search_path pinned
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_signup_questions(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_theme TEXT;
  v_question_id UUID;
  v_count INT := 0;
  v_themes TEXT[] := ARRAY['team','traction','problem','solution','market','vision','personal','fit'];
BEGIN
  -- caller binding (061); the auth.users signup trigger
  -- (auto_seed_questions_on_signup) is the only trigger that calls this
  IF NOT (
       pg_trigger_depth() > 0
    OR coalesce(auth.role(), '') = 'service_role'
    OR (session_user IN ('postgres', 'supabase_admin')
        AND coalesce(auth.role(), '') NOT IN ('anon', 'authenticated'))
    OR (coalesce(auth.role(), '') = 'authenticated'
        AND p_user_id IS NOT NULL AND p_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOREACH v_theme IN ARRAY v_themes LOOP
    SELECT id INTO v_question_id
    FROM archived_questions
    WHERE theme = v_theme
      AND id NOT IN (SELECT archived_question_id FROM user_question_unlocks WHERE user_id = p_user_id)
    ORDER BY significance_score DESC
    LIMIT 1;
    IF v_question_id IS NOT NULL THEN
      INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
      VALUES (p_user_id, v_question_id, 'signup')
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$function$;

-- ------------------------------------------------------------
-- 6. Platform recompute jobs: bodies unchanged, search_path pinned
-- ------------------------------------------------------------
ALTER FUNCTION public.compute_heat_scores() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.compute_program_dna() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.compute_significance_scores() SET search_path = public, extensions, pg_temp;

-- ------------------------------------------------------------
-- 7. get_top_programs_by_value: SECURITY INVOKER, approved programs only
--    (registry slugs as in app/lib/canonical-catalog.ts
--    CANONICAL_PROGRAM_SLUGS, or source = 'canonical')
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_programs_by_value(p_types public.program_type[] DEFAULT NULL::public.program_type[], p_domain text DEFAULT 'founder'::text, p_equity_max numeric DEFAULT NULL::numeric, p_status public.program_status[] DEFAULT ARRAY['open'::public.program_status], p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, name text, slug text, type public.program_type, domain text, status public.program_status, equity_pct numeric, cash_value_usd numeric, credit_value_usd numeric, program_value_score numeric, network_score numeric, brand_score numeric, follow_on_rate_pct numeric, heat_score numeric, is_rolling boolean, deadline_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path = public, pg_temp
AS $function$
  SELECT
    p.id,
    p.name,
    p.slug,
    p.type,
    p.domain,
    p.status,
    p.equity_pct,
    p.cash_value_usd,
    p.credit_value_usd,
    p.program_value_score,
    p.network_score,
    p.brand_score,
    p.follow_on_rate_pct,
    p.heat_score,
    p.is_rolling,
    p.deadline_at
  FROM programs p
  WHERE
    (p.source = 'canonical'
     OR p.slug = ANY (ARRAY['yc-summer-2026', 'founding-500', 'redbud-vc', 'cyberfund-monastery', '3xcapital']))
    AND p.program_value_score IS NOT NULL
    AND (p_types   IS NULL OR p.type   = ANY(p_types))
    AND (p_domain  IS NULL OR p.domain = p_domain)
    AND (p_status  IS NULL OR p.status = ANY(p_status))
    AND (p_equity_max IS NULL OR p.equity_pct IS NULL OR p.equity_pct <= p_equity_max)
  ORDER BY p.program_value_score DESC
  LIMIT LEAST(p_limit, 100);
$function$;

-- ------------------------------------------------------------
-- 8. EXECUTE grants (explicit, W11)
-- ------------------------------------------------------------
-- 8a. user-id functions, recompute jobs, ranking RPC: reset, then grant
REVOKE ALL ON FUNCTION
  public.claim_starter_package(uuid),
  public.run_daily_drip(uuid),
  public.compute_user_fit_scores(uuid),
  public.increment_draft_count(uuid, text),
  public.seed_signup_questions(uuid),
  public.compute_heat_scores(),
  public.compute_program_dna(),
  public.compute_significance_scores(),
  public.get_top_programs_by_value(public.program_type[], text, numeric, public.program_status[], integer)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.claim_starter_package(uuid),
  public.run_daily_drip(uuid)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.compute_user_fit_scores(uuid),
  public.increment_draft_count(uuid, text),
  public.seed_signup_questions(uuid),
  public.compute_heat_scores(),
  public.compute_program_dna(),
  public.compute_significance_scores(),
  public.get_top_programs_by_value(public.program_type[], text, numeric, public.program_status[], integer)
TO service_role;

-- 8b. RLS-policy / guard-trigger helpers: the calling role needs EXECUTE
REVOKE ALL ON FUNCTION
  public.local_first_active(),
  public.is_canonical_program(uuid)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.local_first_active(),
  public.is_canonical_program(uuid)
TO authenticated, service_role;

-- 8c. trigger functions (firing does not check EXECUTE)
REVOKE ALL ON FUNCTION
  public.auto_seed_questions_on_signup(),
  public.award_answer_credits(),
  public.award_contribution_credits(),
  public.award_submission_credits(),
  public.create_free_subscription_on_signup(),
  public.create_user_profile_on_signup(),
  public.increment_asked_by_count(),
  public.decrement_asked_by_count(),
  public.process_reward(),
  public.refresh_canonical_aggregate()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.auto_seed_questions_on_signup(),
  public.award_answer_credits(),
  public.award_contribution_credits(),
  public.award_submission_credits(),
  public.create_free_subscription_on_signup(),
  public.create_user_profile_on_signup(),
  public.increment_asked_by_count(),
  public.decrement_asked_by_count(),
  public.process_reward(),
  public.refresh_canonical_aggregate()
TO service_role;

COMMIT;

-- ============================================================
-- Post-apply read-only verification (owner-run):
--   -- SECURITY DEFINER functions in public executable by anon: none
--   SELECT p.oid::regprocedure FROM pg_proc p
--    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
--      AND has_function_privilege('anon', p.oid, 'EXECUTE');            -- 0 rows
--   -- ... and by authenticated: exactly accept_team_invite,
--   -- claim_starter_package, is_canonical_program, local_first_active
--   SELECT p.oid::regprocedure FROM pg_proc p
--    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
--      AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
--   SELECT proname, prosecdef, proconfig FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--      AND proname IN ('run_daily_drip', 'get_top_programs_by_value');  -- both f
--   SELECT jobname, command FROM cron.job;                              -- unchanged
-- ============================================================
