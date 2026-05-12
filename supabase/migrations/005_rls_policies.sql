-- ============================================================
-- Migration 005: Row Level Security (RLS) Policies
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- Strategy:
--   - Programs, archived_questions, program_questions → public read
--   - All user data (profile_answers, applications, integrations) → owner only
--   - program_signals → insert by anyone (even anon view signals), read by owner
--   - acceptance_reports → insert by auth users, read aggregated by anyone
--   - import_queue → insert by auth users, read/update by admins
--   - ai_draft_runs → owner only
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE archived_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_answers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_answer_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_signals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE acceptance_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_stats             ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_queue              ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_integrations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_draft_runs             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ARCHIVED QUESTIONS — public read, admin write
-- ============================================================

CREATE POLICY "archived_questions_public_read"
  ON archived_questions FOR SELECT
  USING (TRUE);

CREATE POLICY "archived_questions_admin_insert"
  ON archived_questions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');  -- tighten to admin role in production

CREATE POLICY "archived_questions_admin_update"
  ON archived_questions FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ============================================================
-- PROGRAMS — public read, auth write (funders can add programs)
-- ============================================================

CREATE POLICY "programs_public_read"
  ON programs FOR SELECT
  USING (TRUE);

CREATE POLICY "programs_auth_insert"
  ON programs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "programs_owner_or_admin_update"
  ON programs FOR UPDATE
  USING (
    funder_user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

-- ============================================================
-- PROGRAM QUESTIONS — public read, tied to program owner write
-- ============================================================

CREATE POLICY "program_questions_public_read"
  ON program_questions FOR SELECT
  USING (TRUE);

CREATE POLICY "program_questions_auth_insert"
  ON program_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = program_id
        AND (p.funder_user_id = auth.uid() OR auth.role() = 'service_role')
    )
  );

CREATE POLICY "program_questions_auth_update"
  ON program_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = program_id
        AND (p.funder_user_id = auth.uid() OR auth.role() = 'service_role')
    )
  );

-- ============================================================
-- PROFILE ANSWERS — owner only
-- ============================================================

CREATE POLICY "profile_answers_owner_select"
  ON profile_answers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "profile_answers_owner_insert"
  ON profile_answers FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profile_answers_owner_update"
  ON profile_answers FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "profile_answers_owner_delete"
  ON profile_answers FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- PROFILE ANSWER HISTORY — owner only (via join)
-- ============================================================

CREATE POLICY "profile_answer_history_owner_select"
  ON profile_answer_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profile_answers pa
      WHERE pa.id = profile_answer_id
        AND pa.user_id = auth.uid()
    )
  );

-- Inserts handled by trigger (runs as SECURITY DEFINER if needed)
-- No direct user insert policy — trigger only

-- ============================================================
-- USER APPLICATIONS — owner only
-- ============================================================

CREATE POLICY "user_applications_owner_select"
  ON user_applications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_applications_owner_insert"
  ON user_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_applications_owner_update"
  ON user_applications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "user_applications_owner_delete"
  ON user_applications FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- APPLICATION ANSWERS — owner only
-- ============================================================

CREATE POLICY "application_answers_owner_select"
  ON application_answers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "application_answers_owner_insert"
  ON application_answers FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "application_answers_owner_update"
  ON application_answers FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "application_answers_owner_delete"
  ON application_answers FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- PROGRAM SIGNALS — insert by anyone (views are anonymous-ok),
-- read only by owner of that signal row
-- ============================================================

CREATE POLICY "program_signals_anon_insert"
  ON program_signals FOR INSERT
  WITH CHECK (TRUE);  -- anon views allowed; user_id nullable

CREATE POLICY "program_signals_owner_select"
  ON program_signals FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================
-- ACCEPTANCE REPORTS — auth insert, public aggregate read
-- Direct row read = owner only
-- ============================================================

CREATE POLICY "acceptance_reports_owner_insert"
  ON acceptance_reports FOR INSERT
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY "acceptance_reports_owner_select"
  ON acceptance_reports FOR SELECT
  USING (reported_by = auth.uid() OR verified = TRUE);

-- ============================================================
-- PROGRAM STATS — public read, service_role write (trigger/cron)
-- ============================================================

CREATE POLICY "program_stats_public_read"
  ON program_stats FOR SELECT
  USING (TRUE);

CREATE POLICY "program_stats_service_write"
  ON program_stats FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- IMPORT QUEUE — auth insert, admin/service review
-- ============================================================

CREATE POLICY "import_queue_auth_insert"
  ON import_queue FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "import_queue_owner_read"
  ON import_queue FOR SELECT
  USING (submitted_by = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "import_queue_service_update"
  ON import_queue FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================
-- CONNECTED INTEGRATIONS — owner only (keys are sensitive)
-- ============================================================

CREATE POLICY "integrations_owner_select"
  ON connected_integrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "integrations_owner_insert"
  ON connected_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "integrations_owner_update"
  ON connected_integrations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "integrations_owner_delete"
  ON connected_integrations FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- AI DRAFT RUNS — owner only
-- ============================================================

CREATE POLICY "ai_draft_runs_owner_select"
  ON ai_draft_runs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ai_draft_runs_owner_insert"
  ON ai_draft_runs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No update/delete on draft runs — they are an append-only record
