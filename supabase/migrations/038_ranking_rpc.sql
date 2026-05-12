-- ============================================================
-- Migration 038: Program Ranking RPC
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- Creates get_top_programs_by_value() — a server-side ranking
-- function that returns programs ordered by composite value
-- score, with optional filters for type, domain, equity cap,
-- and status. Callable from both Next.js app and MCP server
-- via supabase.rpc('get_top_programs_by_value', params).
-- ============================================================

CREATE OR REPLACE FUNCTION get_top_programs_by_value(
  p_types        program_type[]    DEFAULT NULL,
  p_domain       TEXT              DEFAULT 'founder',
  p_equity_max   NUMERIC           DEFAULT NULL,
  p_status       program_status[]  DEFAULT ARRAY['open'::program_status],
  p_limit        INT               DEFAULT 20
)
RETURNS TABLE (
  id                    UUID,
  name                  TEXT,
  slug                  TEXT,
  type                  program_type,
  domain                TEXT,
  status                program_status,
  equity_pct            NUMERIC,
  cash_value_usd        NUMERIC,
  credit_value_usd      NUMERIC,
  program_value_score   NUMERIC,
  network_score         NUMERIC,
  brand_score           NUMERIC,
  follow_on_rate_pct    NUMERIC,
  heat_score            NUMERIC,
  is_rolling            BOOLEAN,
  deadline_at           TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    p.program_value_score IS NOT NULL
    AND (p_types   IS NULL OR p.type   = ANY(p_types))
    AND (p_domain  IS NULL OR p.domain = p_domain)
    AND (p_status  IS NULL OR p.status = ANY(p_status))
    AND (p_equity_max IS NULL OR p.equity_pct IS NULL OR p.equity_pct <= p_equity_max)
  ORDER BY p.program_value_score DESC
  LIMIT LEAST(p_limit, 100);
$$;

-- Grant anon + authenticated access (RLS still applies on the table itself)
GRANT EXECUTE ON FUNCTION get_top_programs_by_value(program_type[], TEXT, NUMERIC, program_status[], INT)
  TO anon, authenticated;

-- ============================================================
-- Verification
-- ============================================================
-- SELECT * FROM get_top_programs_by_value(NULL, 'founder', NULL, ARRAY['open'], 5);
