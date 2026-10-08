-- ============================================================
-- 050 — M05 migration-integrity repairs (forward-only)
-- ============================================================
-- Verbatim-apply failures found by M05 rehearsal (R07 evidence):
--   008: "SELECT cron.schedule(...) ON CONFLICT DO NOTHING" — invalid syntax
--        verbatim; the four refresh jobs were never scheduled by the file.
--   019: seed used program_source='fundingcake' before the enum value existed.
--   028: seed referenced programs.domain before 034 added the column.
-- Historical migrations are NOT rewritten; this forward-only migration
-- restores the intended end-state. Seed content from 019/028 remains a
-- documented gap (deployment-owner decision whether to load it — do NOT
-- bulk-insert it here).
-- ============================================================

-- 1. program_source: add the value 019 assumed existed.
ALTER TYPE program_source ADD VALUE IF NOT EXISTS 'fundingcake';

-- 2. 008 intended jobs, restated correctly (idempotent via NOT EXISTS guard).
DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.schedule('refresh-significance-scores','0 2 * * *',
      'SELECT compute_significance_scores();')
    WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='refresh-significance-scores');
    PERFORM cron.schedule('refresh-program-dna','30 2 * * *',
      'SELECT compute_program_dna();')
    WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='refresh-program-dna');
    PERFORM cron.schedule('refresh-fit-scores','0 3 * * *',
      'SELECT compute_user_fit_scores(NULL);')
    WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='refresh-fit-scores');
    PERFORM cron.schedule('refresh-heat-scores','0 */6 * * *',
      $job$
        UPDATE program_stats ps
        SET trending_score = COALESCE((
          SELECT COUNT(*) * 1.0 FROM program_signals sig
          WHERE sig.program_id = ps.program_id
            AND sig.created_at > NOW() - INTERVAL '48 hours'
            AND sig.signal_type IN ('view', 'save', 'start')), 0),
            updated_at = NOW()
        FROM programs p WHERE p.id = ps.program_id AND p.status = 'open';
        UPDATE programs p SET heat_score = COALESCE(ps.trending_score, 0)
        FROM program_stats ps WHERE ps.program_id = p.id;
      $job$)
    WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='refresh-heat-scores');
  END IF;
END $$;
