-- Migration 022: unique constraint on user_integrations (user_id, provider)
-- Required for upsert ON CONFLICT (user_id,provider) in POST /api/integrations.
-- One row per user per provider. Deduplicates any existing rows (keep newest).

DELETE FROM user_integrations
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, provider) id
  FROM user_integrations
  ORDER BY user_id, provider, created_at DESC
);

ALTER TABLE user_integrations
  ADD CONSTRAINT uq_user_integrations_user_provider
  UNIQUE (user_id, provider);
