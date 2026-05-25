-- ============================================================
-- 043 — Canonical RPC Functions
-- ============================================================
-- Search, package retrieval, and smart matcher primitives.
-- Embeddings are generated outside Postgres and passed as vector(768).
-- ============================================================

ALTER TABLE canonical_commitments
  ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS idx_canonical_embedding
  ON canonical_commitments USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

CREATE OR REPLACE FUNCTION semantic_search_canonicals(
  query_embedding vector(768),
  limit_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.55
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  aggregate_description TEXT,
  vertical TEXT,
  significance_score NUMERIC,
  qualification_tags TEXT[],
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.aggregate_description,
    c.vertical,
    c.significance_score,
    c.qualification_tags,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM canonical_commitments c
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_canonicals_hybrid(
  query_text TEXT,
  vertical_filter TEXT DEFAULT NULL,
  limit_count INT DEFAULT 20,
  query_embedding vector(768) DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  vertical TEXT,
  significance_score NUMERIC,
  fidelity_potential NUMERIC,
  rank INT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH scored AS (
    SELECT
      c.id,
      c.title,
      c.vertical,
      c.significance_score,
      CASE
        WHEN query_embedding IS NOT NULL AND c.embedding IS NOT NULL
          THEN 1 - (c.embedding <=> query_embedding)
        ELSE 0
      END::FLOAT AS vector_similarity,
      ts_rank_cd(
        to_tsvector('english', COALESCE(c.title, '') || ' ' || COALESCE(c.aggregate_description, '')),
        plainto_tsquery('english', COALESCE(query_text, ''))
      )::FLOAT AS text_rank
    FROM canonical_commitments c
    WHERE (vertical_filter IS NULL OR c.vertical = vertical_filter)
      AND (
        query_text IS NULL
        OR query_text = ''
        OR to_tsvector('english', COALESCE(c.title, '') || ' ' || COALESCE(c.aggregate_description, ''))
           @@ plainto_tsquery('english', query_text)
        OR query_embedding IS NOT NULL
      )
  )
  SELECT
    s.id,
    s.title,
    s.vertical,
    s.significance_score,
    LEAST(1, GREATEST(0, (s.vector_similarity * 0.65) + (s.text_rank * 0.25) + (s.significance_score::FLOAT * 0.10)))::NUMERIC AS fidelity_potential,
    ROW_NUMBER() OVER (
      ORDER BY (s.vector_similarity * 0.65) + (s.text_rank * 0.25) + (s.significance_score::FLOAT * 0.10) DESC
    )::INT AS rank,
    s.vector_similarity AS similarity
  FROM scored s
  ORDER BY rank
  LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_canonical_package(
  canonical_id UUID,
  user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'canonical', to_jsonb(c),
    'variants', COALESCE((
      SELECT jsonb_agg(to_jsonb(v) ORDER BY v.fidelity_score DESC NULLS LAST, v.updated_at DESC)
      FROM answer_variants v
      WHERE v.canonical_id = c.id
        AND (user_id IS NULL OR v.user_id = user_id)
    ), '[]'::jsonb),
    'lineage', COALESCE((
      SELECT jsonb_agg(to_jsonb(le) ORDER BY le.created_at DESC)
      FROM lineage_events le
      WHERE le.entity_type = 'canonical'
        AND le.entity_id = c.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM canonical_commitments c
  WHERE c.id = canonical_id;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION calculate_fit_score(
  program_value_score FLOAT,
  heat_score FLOAT,
  brand_score FLOAT,
  significance_score NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(LEAST(100, GREATEST(0,
    COALESCE(program_value_score, 40) * 0.35
    + COALESCE(heat_score, 35) * 0.25
    + COALESCE(brand_score, 35) * 0.20
    + (COALESCE(significance_score, 0)::FLOAT * 100) * 0.20
  ))::NUMERIC, 2);
$$;

CREATE OR REPLACE FUNCTION smart_matcher_search(
  user_persona JSONB DEFAULT '{}'::jsonb,
  vertical_filter TEXT DEFAULT 'founder',
  match_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  entity_name TEXT,
  fit_score NUMERIC,
  significance_score NUMERIC,
  reasoning_snippet TEXT,
  deadline TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name AS entity_name,
    calculate_fit_score(p.program_value_score, p.heat_score, p.brand_score, COALESCE(AVG(c.significance_score), 0)) AS fit_score,
    COALESCE(AVG(c.significance_score), 0)::NUMERIC AS significance_score,
    CONCAT(
      'Matched on ',
      COALESCE(NULLIF(array_to_string(p.industry_tags, ', '), ''), 'general application readiness'),
      ' with value and deadline signals.'
    ) AS reasoning_snippet,
    p.deadline_at AS deadline
  FROM programs p
  LEFT JOIN application_packages ap
    ON ap.program_entity = p.name
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(ap.commitments, '[]'::jsonb)) pc ON true
  LEFT JOIN canonical_commitments c
    ON c.id::text = pc.value->>'canonical_id'
  WHERE (
    vertical_filter IS NULL
    OR vertical_filter = 'founder'
    OR p.type::text = vertical_filter
  )
  GROUP BY p.id, p.name, p.program_value_score, p.heat_score, p.brand_score, p.industry_tags, p.deadline_at
  ORDER BY fit_score DESC, p.deadline_at ASC NULLS LAST
  LIMIT match_limit;
END;
$$;
