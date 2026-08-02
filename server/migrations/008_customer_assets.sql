ALTER TABLE customer_sessions
  ADD COLUMN IF NOT EXISTS last_authenticated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS customer_sessions_recent_auth_idx
  ON customer_sessions (customer_id, last_authenticated_at DESC);
