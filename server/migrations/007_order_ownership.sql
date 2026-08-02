CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
  ownership_status TEXT NOT NULL CHECK (ownership_status IN ('OWNED', 'GUEST_UNCLAIMED', 'LEGACY_UNRESOLVED', 'MANUAL_REVIEW')),
  guest_email_snapshot TEXT,
  guest_phone_snapshot TEXT,
  claimed_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES customers(id) ON DELETE RESTRICT,
  ownership_version INTEGER NOT NULL DEFAULT 1 CHECK (ownership_version > 0),
  status TEXT NOT NULL,
  currency TEXT NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK ((ownership_status = 'OWNED' AND customer_id IS NOT NULL) OR (ownership_status <> 'OWNED' AND customer_id IS NULL))
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL CHECK (item_index >= 0),
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  UNIQUE (order_id, item_index)
);

CREATE TABLE IF NOT EXISTS guest_order_claims (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('email')),
  contact_value_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  requested_by_session_id UUID,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS order_ownership_events (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  from_customer_id UUID,
  to_customer_id UUID,
  action TEXT NOT NULL CHECK (action IN ('ORDER_CREATED_AUTHENTICATED', 'ORDER_CREATED_GUEST', 'GUEST_CLAIM_REQUESTED', 'GUEST_CLAIM_CONFIRMED', 'GUEST_CLAIM_REJECTED', 'ADMIN_MANUAL_RESOLUTION', 'MIGRATION_MARKED_UNRESOLVED')),
  actor_type TEXT NOT NULL,
  actor_id UUID,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders(customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_ownership_status_idx ON orders(ownership_status, created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id, item_index);
CREATE INDEX IF NOT EXISTS guest_order_claims_active_idx ON guest_order_claims(order_id, expires_at) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS order_ownership_events_order_idx ON order_ownership_events(order_id, created_at DESC);
