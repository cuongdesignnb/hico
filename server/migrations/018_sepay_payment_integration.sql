-- Catalog performance + SePay integration. Secrets are stored only as encrypted metadata.
CREATE TABLE IF NOT EXISTS payment_integration_settings (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'SEPAY'),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  bank_account_masked TEXT,
  bank_account_hash TEXT,
  account_holder TEXT,
  bank_name TEXT,
  order_reference_prefix TEXT NOT NULL DEFAULT 'HICO',
  webhook_path TEXT NOT NULL DEFAULT '/api/webhooks/sepay',
  encrypted_credential JSONB,
  credential_masked TEXT,
  credential_fingerprint TEXT,
  encryption_key_version TEXT,
  status TEXT NOT NULL DEFAULT 'DISABLED' CHECK (status IN ('DISABLED', 'CONFIGURED', 'ERROR', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'SEPAY'),
  provider_event_id TEXT NOT NULL,
  payload_hash TEXT,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'SEPAY'),
  provider_transaction_id TEXT NOT NULL,
  order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'MANUAL_REVIEW')),
  match_status TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency = 'VND'),
  account_masked TEXT,
  reference_code TEXT,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_transaction_id)
);

CREATE INDEX IF NOT EXISTS payment_transactions_order_idx ON payment_transactions(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON payment_transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_webhook_events_received_idx ON payment_webhook_events(provider, received_at DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_currency TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

INSERT INTO payment_integration_settings (id, provider, webhook_path)
VALUES ('sepay', 'SEPAY', '/api/webhooks/sepay')
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_permissions (name)
VALUES ('payments.settings.read'), ('payments.settings.write'), ('payments.transactions.read')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'technical_admin', name FROM admin_permissions WHERE name IN ('payments.settings.read', 'payments.settings.write', 'payments.transactions.read')
ON CONFLICT DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'order_operator', name FROM admin_permissions WHERE name = 'payments.transactions.read'
ON CONFLICT DO NOTHING;
