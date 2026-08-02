CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  user_agent_hash TEXT,
  ip_prefix_hash TEXT,
  session_version INTEGER NOT NULL DEFAULT 1
);
