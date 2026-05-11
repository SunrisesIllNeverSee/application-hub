-- ============================================================
-- 029 — Resize embedding column: vector(1536) → vector(768)
-- ============================================================
-- No embeddings were seeded (all NULL), so this is a safe
-- column replacement. Switching to 768 dims to match:
--   - nomic-embed-text (Ollama, free, local)
--   - OpenAI text-embedding-3-small with dimensions=768
--
-- Applied directly 2026-05-11. Migration file added for record.
-- ============================================================

ALTER TABLE archived_questions DROP COLUMN IF EXISTS embedding;
ALTER TABLE archived_questions ADD COLUMN embedding vector(768);

DROP FUNCTION IF EXISTS match_archived_questions(vector(1536), float, int);

CREATE OR REPLACE FUNCTION match_archived_questions(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.72,
  match_count     int   DEFAULT 10
)
RETURNS TABLE (
  id                UUID,
  text              TEXT,
  theme             TEXT,
  significance_score FLOAT,
  asked_by_count    INT,
  is_universal      BOOLEAN,
  similarity        FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    aq.id, aq.text, aq.theme, aq.significance_score,
    aq.asked_by_count, aq.is_universal,
    1 - (aq.embedding <=> query_embedding) AS similarity
  FROM archived_questions aq
  WHERE aq.embedding IS NOT NULL
    AND 1 - (aq.embedding <=> query_embedding) >= match_threshold
  ORDER BY aq.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_archived_questions_embedding
  ON archived_questions USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
