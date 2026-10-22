-- ============================================================
-- M09 W11 grants harness: snapshot helpers (schema p0g)
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY. p0g.snapshot() renders every relation in
-- schema public (tables, views, matviews, sequences, partitioned and
-- foreign tables) in exactly the format of
-- supabase/tests/m09/fixtures/production_grants_2026-10-22.psv:
--   relname|relkind|anon=<p> authenticated=<p> PUBLIC=<p> service_role=<p>
-- plus one 'COL|table.column|role=<p> ...' line per column ACL.
-- Letters: a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES
-- t=TRIGGER m=MAINTAIN U=USAGE, '-' = none. These are the direct ACL
-- entries (aclexplode). A PUBLIC entry also applies to every API role, so
-- it is reported separately; the API roles are NOINHERIT members of nothing.
-- ============================================================
CREATE SCHEMA IF NOT EXISTS p0g;

CREATE OR REPLACE FUNCTION p0g.privs(p_acl aclitem[], p_grantee text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(string_agg(substr('arwdDxtmU', o.ord, 1), '' ORDER BY o.ord), '-')
  FROM aclexplode(p_acl) a
  JOIN (VALUES ('INSERT',1),('SELECT',2),('UPDATE',3),('DELETE',4),('TRUNCATE',5),
               ('REFERENCES',6),('TRIGGER',7),('MAINTAIN',8),('USAGE',9)) o(t, ord)
    ON o.t = a.privilege_type
  WHERE a.grantee = CASE p_grantee WHEN 'PUBLIC' THEN 0::oid ELSE p_grantee::regrole::oid END
$$;

CREATE OR REPLACE FUNCTION p0g.acl_text(p_acl aclitem[])
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(r || '=' || p0g.privs(p_acl, r), ' ' ORDER BY i)
  FROM unnest(ARRAY['anon','authenticated','PUBLIC','service_role']) WITH ORDINALITY u(r, i)
$$;

CREATE OR REPLACE FUNCTION p0g.snapshot()
RETURNS TABLE(line text) LANGUAGE sql STABLE AS $$
  SELECT x.line FROM (
    SELECT c.relname::text || '|' || c.relkind::text || '|' || p0g.acl_text(c.relacl) AS line
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','S','p','f')
    UNION ALL
    SELECT 'COL|' || c.relname::text || '.' || a.attname::text || '|' || p0g.acl_text(a.attacl)
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
  ) x ORDER BY x.line COLLATE "C"
$$;
