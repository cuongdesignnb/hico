ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS locale TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_idx
  ON customer_addresses (customer_id) WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS customer_contact_changes (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('EMAIL', 'PHONE')),
  new_value_normalized TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'CONSUMED', 'EXPIRED', 'CANCELLED')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS customer_contact_changes_customer_idx
  ON customer_contact_changes (customer_id, contact_type, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_contact_changes_active_idx
  ON customer_contact_changes (customer_id, contact_type, expires_at)
  WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ACCOUNT', 'ORDER', 'ASSET', 'TECHNICAL', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
  customer_asset_id TEXT,
  assigned_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS support_tickets_customer_idx
  ON support_tickets (customer_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON support_tickets (status, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_order_owner_idx
  ON support_tickets (customer_id, order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_tickets_asset_owner_idx
  ON support_tickets (customer_id, customer_asset_id) WHERE customer_asset_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('CUSTOMER', 'ADMIN')),
  sender_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  sender_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (visibility IN ('CUSTOMER', 'INTERNAL')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  edited_at TIMESTAMPTZ,
  CHECK ((sender_type = 'CUSTOMER' AND sender_customer_id IS NOT NULL AND sender_admin_id IS NULL AND visibility = 'CUSTOMER') OR
         (sender_type = 'ADMIN' AND sender_admin_id IS NOT NULL AND sender_customer_id IS NULL))
);

CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx
  ON support_ticket_messages (ticket_id, created_at, id);

CREATE TABLE IF NOT EXISTS support_attachments (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES support_ticket_messages(id) ON DELETE SET NULL,
  uploaded_by_type TEXT NOT NULL CHECK (uploaded_by_type IN ('CUSTOMER', 'ADMIN')),
  uploaded_by_id UUID NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_name_safe TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'QUARANTINED', 'DELETED')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS support_attachments_ticket_idx
  ON support_attachments (ticket_id, created_at DESC);

ALTER TABLE customer_notifications
  DROP CONSTRAINT IF EXISTS customer_notifications_type_check;
ALTER TABLE customer_notifications
  ADD CONSTRAINT customer_notifications_type_check CHECK (type IN (
    'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ESIM_PROVISIONED', 'ESIM_PENDING_QR',
    'PHYSICAL_SIM_SHIPPED', 'TOPUP_COMPLETED', 'LOYALTY_EARNED', 'LOYALTY_REVERSED',
    'REFERRAL_APPLIED', 'REFERRAL_QUALIFIED', 'REFERRAL_REWARD', 'SECURITY_EVENT',
    'SUPPORT_TICKET_CREATED', 'SUPPORT_REPLY_RECEIVED', 'SUPPORT_STATUS_CHANGED',
    'SUPPORT_TICKET_CLOSED', 'SECURITY_PROFILE_CHANGED', 'SECURITY_PASSWORD_CHANGED',
    'SECURITY_SESSION_REVOKED'
  ));

INSERT INTO admin_permissions (name)
VALUES ('support.read'), ('support.reply'), ('support.assign'), ('support.status')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'super_admin', name FROM admin_permissions
WHERE name IN ('support.read', 'support.reply', 'support.assign', 'support.status')
ON CONFLICT DO NOTHING;
