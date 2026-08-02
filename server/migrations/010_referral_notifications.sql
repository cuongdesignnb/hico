ALTER TABLE loyalty_ledger
  DROP CONSTRAINT IF EXISTS loyalty_ledger_type_check;

ALTER TABLE loyalty_ledger
  ADD CONSTRAINT loyalty_ledger_type_check
  CHECK (type IN ('EARN', 'REDEEM', 'RESERVE', 'RELEASE', 'REVERSE', 'REFERRAL_REWARD', 'ADJUST_ADMIN', 'EXPIRE'));

ALTER TABLE loyalty_ledger
  DROP CONSTRAINT IF EXISTS loyalty_ledger_check;

ALTER TABLE loyalty_ledger
  DROP CONSTRAINT IF EXISTS loyalty_ledger_check1;

ALTER TABLE loyalty_ledger
  DROP CONSTRAINT IF EXISTS loyalty_ledger_points_sign_check;

ALTER TABLE loyalty_ledger
  ADD CONSTRAINT loyalty_ledger_points_sign_check
  CHECK (
    (type IN ('EARN', 'REFERRAL_REWARD') AND points > 0)
    OR (type IN ('REDEEM', 'RESERVE', 'EXPIRE', 'REVERSE') AND points < 0)
    OR (type = 'RELEASE' AND points > 0)
    OR type = 'ADJUST_ADMIN'
  );

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_active_customer_idx
  ON referral_codes (customer_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS referral_relationships (
  id UUID PRIMARY KEY,
  referrer_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  referee_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'QUALIFIED', 'REWARDED', 'REVERSED', 'REJECTED', 'MANUAL_REVIEW')),
  source TEXT NOT NULL DEFAULT 'CUSTOMER_CODE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (referrer_customer_id <> referee_customer_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_relationships_active_referee_idx
  ON referral_relationships (referee_customer_id)
  WHERE status IN ('PENDING', 'QUALIFIED', 'REWARDED', 'MANUAL_REVIEW');
CREATE INDEX IF NOT EXISTS referral_relationships_referrer_idx
  ON referral_relationships (referrer_customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_relationships_status_idx
  ON referral_relationships (status, created_at DESC);

CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES referral_relationships(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  order_id TEXT REFERENCES orders(order_id) ON DELETE RESTRICT,
  business_event_key TEXT NOT NULL UNIQUE,
  rule_id TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS referral_events_relationship_idx
  ON referral_events (relationship_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_events_order_idx
  ON referral_events (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES referral_relationships(id) ON DELETE RESTRICT,
  reward_side TEXT NOT NULL CHECK (reward_side IN ('REFERRER', 'REFEREE')),
  ledger_entry_id UUID NOT NULL UNIQUE REFERENCES loyalty_ledger(id) ON DELETE RESTRICT,
  order_id TEXT REFERENCES orders(order_id) ON DELETE RESTRICT,
  rule_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (relationship_id, reward_side)
);

CREATE INDEX IF NOT EXISTS referral_rewards_relationship_idx
  ON referral_rewards (relationship_id, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_notifications (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ESIM_PROVISIONED', 'ESIM_PENDING_QR', 'PHYSICAL_SIM_SHIPPED', 'TOPUP_COMPLETED', 'LOYALTY_EARNED', 'LOYALTY_REVERSED', 'REFERRAL_APPLIED', 'REFERRAL_QUALIFIED', 'REFERRAL_REWARD', 'SECURITY_EVENT')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ', 'ARCHIVED')),
  dedupe_key TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  action_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (customer_id, dedupe_key),
  CHECK (action_path IS NULL OR (action_path LIKE '/%' AND action_path NOT LIKE '//%'))
);

CREATE INDEX IF NOT EXISTS customer_notifications_customer_created_idx
  ON customer_notifications (customer_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS customer_notifications_unread_idx
  ON customer_notifications (customer_id, status, created_at DESC)
  WHERE status = 'UNREAD';
CREATE INDEX IF NOT EXISTS customer_notifications_entity_idx
  ON customer_notifications (entity_type, entity_id, created_at DESC);

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
  'referral_first_qualifying_order',
  'v1',
  TRUE,
  'referral_reward',
  'VND',
  'eligible_item_subtotal',
  1,
  'floor',
  '2026-01-01T00:00:00Z',
  '{"rewardPointsBySide":{"REFERRER":50,"REFEREE":50},"qualifyingEvent":"first_owned_qualifying_order_milestone","eligibleCurrency":"VND","expiry":"none","selfReferral":"same_customer_email_or_phone_blocked"}'::jsonb
)
ON CONFLICT (rule_id, version) DO NOTHING;

INSERT INTO admin_permissions (name)
VALUES ('referrals.read'), ('referrals.review')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'super_admin', name FROM admin_permissions WHERE name IN ('referrals.read', 'referrals.review')
ON CONFLICT DO NOTHING;
