-- ============================================================
-- 048 — Fix program_next_cycle security mode
-- ============================================================
-- Supabase linter flagged public.program_next_cycle as a SECURITY DEFINER
-- view. Recreate it with security_invoker = true so queries respect the
-- caller's permissions and RLS on program_cycles.
-- ============================================================

CREATE OR REPLACE VIEW public.program_next_cycle
  WITH (security_invoker = true)
AS
SELECT DISTINCT ON (program_id)
  program_id,
  id           AS cycle_id,
  cycle_name,
  opens_at,
  closes_at,
  cohort_name,
  cohort_size,
  apply_url
FROM public.program_cycles
WHERE is_active = TRUE
ORDER BY program_id, closes_at ASC NULLS LAST;

ALTER VIEW public.program_next_cycle OWNER TO postgres;

GRANT SELECT ON public.program_next_cycle TO authenticated, anon;
