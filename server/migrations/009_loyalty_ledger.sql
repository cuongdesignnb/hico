CREATE TABLE IF NOT EXISTS loyalty_accounts (
  customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_rules (
  rule_id TEXT NOT NULL,
  version TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  operation TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency = 'VND'),
  earn_basis TEXT NOT NULL CHECK (earn_basis = 'eligible_item_subtotal'),
  points_per_currency_unit NUMERIC(18, 8) NOT NULL CHECK (points_per_currency_unit > 0),
  rounding_mode TEXT NOT NULL CHECK (rounding_mode = 'floor'),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  config_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (rule_id, version),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('EARN', 'REDEEM', 'RESERVE', 'RELEASE', 'REVERSE', 'ADJUST_ADMIN', 'EXPIRE')),
  points INTEGER NOT NULL CHECK (points <> 0),
  order_id TEXT REFERENCES orders(order_id) ON DELETE RESTRICT,
  order_item_id TEXT,
  rule_id TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  business_event_key TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  reversed_entry_id UUID REFERENCES loyalty_ledger(id) ON DELETE RESTRICT,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('SYSTEM', 'CUSTOMER', 'ADMIN')),
  created_by_id UUID,
  CHECK (reversed_entry_id IS NULL OR reversed_entry_id <> id),
  CHECK (
    (type = 'EARN' AND points > 0)
    OR (type IN ('REDEEM', 'RESERVE', 'EXPIRE', 'REVERSE') AND points < 0)
    OR (type = 'RELEASE' AND points > 0)
    OR type = 'ADJUST_ADMIN'
  )
);

CREATE INDEX IF NOT EXISTS loyalty_ledger_customer_effective_idx
  ON loyalty_ledger (customer_id, effective_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS loyalty_ledger_order_idx
  ON loyalty_ledger (order_id, order_item_id);
CREATE INDEX IF NOT EXISTS loyalty_ledger_type_idx
  ON loyalty_ledger (customer_id, type, effective_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_reverse_source_idx
  ON loyalty_ledger (reversed_entry_id)
  WHERE type = 'REVERSE' AND reversed_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS loyalty_rules_active_idx
  ON loyalty_rules (enabled, effective_from, effective_to);

INSERT INTO loyalty_rules (
  rule_id,
  version,
  enabled,
  operation,
  currency,
  earn_basis,
  points_per_currency_unit,
  rounding_mode,
  effective_from,
  config_jsonb
) VALUES (
  'catalog_fulfillment',
  'v1',
  TRUE,
  'catalog_fulfillment',
  'VND',
  'eligible_item_subtotal',
  0.0001,
  'floor',
  '2026-01-01T00:00:00Z',
  '{"eligibleCurrency":"VND","minimumPositiveSubtotal":true,"excludedItemTypes":["excluded","promo_only"],"milestones":{"esim":"PROVISIONED","topup":"PROVISIONED","physical_sim":"SHIPPED","device_sale":"SHIPPED"}}'::jsonb
)
ON CONFLICT (rule_id, version) DO NOTHING;

INSERT INTO admin_permissions (name)
VALUES ('loyalty.adjust')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'super_admin', 'loyalty.adjust'
WHERE EXISTS (SELECT 1 FROM admin_roles WHERE name = 'super_admin')
ON CONFLICT DO NOTHING;
