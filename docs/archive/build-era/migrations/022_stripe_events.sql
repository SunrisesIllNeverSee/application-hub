-- ============================================================
-- Migration 022: Stripe webhook event deduplication
-- ============================================================
-- Stripe retries webhook deliveries on any non-2xx response and can
-- also re-deliver successful events during outages. Without dedup
-- our subscription state mutations would apply twice on retries,
-- which can corrupt tier downgrades / period dates.
--
-- The webhook handler INSERTs the event.id BEFORE processing the
-- event payload. The UNIQUE constraint on event_id means the second
-- INSERT raises duplicate_key — the handler treats that as "already
-- processed" and returns 200 immediately without touching state.
-- ============================================================

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id      TEXT PRIMARY KEY,            -- Stripe event ID (evt_...)
  event_type    TEXT NOT NULL,               -- e.g. checkout.session.completed
  livemode      BOOLEAN NOT NULL,            -- false = test mode, true = production
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,                 -- NULL until handler completes
  error_text    TEXT                         -- non-null if handler raised
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_received
  ON stripe_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type
  ON stripe_events (event_type);

-- RLS: service role only — webhook is the only writer/reader
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stripe_events' AND policyname = 'stripe_events_service_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "stripe_events_service_all" ON stripe_events
        FOR ALL USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role')
    $p$;
  END IF;
END $$;
