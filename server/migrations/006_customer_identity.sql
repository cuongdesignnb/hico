CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  normalized_email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'active', 'disabled', 'locked')),
  email_verified_at TIMESTAMPTZ,
  failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ NOT NULL,
  credential_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_profiles (
  customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  normalized_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id UUID PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  replaced_by_session_id UUID,
  session_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customer_email_verifications (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_password_resets (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_security_events (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  phone_snapshot TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  ward TEXT,
  district TEXT,
  city TEXT,
  country_code TEXT NOT NULL DEFAULT 'VN',
  postal_code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS customers_status_idx ON customers (status);
CREATE INDEX IF NOT EXISTS customer_profiles_normalized_phone_idx ON customer_profiles (normalized_phone) WHERE normalized_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_sessions_customer_id_idx ON customer_sessions (customer_id);
CREATE INDEX IF NOT EXISTS customer_sessions_cleanup_idx ON customer_sessions (expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS customer_email_verifications_active_idx ON customer_email_verifications (customer_id, expires_at) WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS customer_password_resets_active_idx ON customer_password_resets (customer_id, expires_at) WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS customer_security_events_customer_id_idx ON customer_security_events (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_addresses_customer_id_idx ON customer_addresses (customer_id, created_at DESC);
