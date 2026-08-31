-- PR15.8.2.5B.8: explicit catalog variant -> provider fulfillment bindings.
-- Provider offers remain an external/provider snapshot. This table only stores
-- an approved binding and its immutable audit/version history.
CREATE TABLE IF NOT EXISTS catalog_variant_fulfillment_bindings (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('WORLDMOVE')),
  strategy TEXT NOT NULL CHECK (strategy IN ('MAPPED_FALLBACK')),
  provider_offer_id TEXT NOT NULL,
  family_key TEXT NOT NULL,
  requested_days INTEGER NOT NULL CHECK (requested_days > 0),
  provider_days INTEGER NOT NULL CHECK (provider_days >= requested_days),
  upgrade_days INTEGER NOT NULL CHECK (upgrade_days = provider_days - requested_days),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  provider_snapshot_hash TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_variant_fulfillment_bindings_active_key
  ON catalog_variant_fulfillment_bindings(variant_id, provider)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS catalog_variant_fulfillment_bindings_variant_idx
  ON catalog_variant_fulfillment_bindings(variant_id, provider, status);

CREATE INDEX IF NOT EXISTS catalog_variant_fulfillment_bindings_offer_idx
  ON catalog_variant_fulfillment_bindings(provider, provider_offer_id, status);

CREATE TABLE IF NOT EXISTS catalog_variant_fulfillment_binding_events (
  id BIGSERIAL PRIMARY KEY,
  binding_id TEXT NOT NULL REFERENCES catalog_variant_fulfillment_bindings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATE', 'REMAP', 'REVOKE')),
  actor_id TEXT,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin_permissions (name)
VALUES ('catalog.fulfillment.read'), ('catalog.fulfillment.write')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'catalog_manager', name
FROM admin_permissions
WHERE name IN ('catalog.fulfillment.read', 'catalog.fulfillment.write')
ON CONFLICT DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'technical_admin', name
FROM admin_permissions
WHERE name IN ('catalog.fulfillment.read', 'catalog.fulfillment.write')
ON CONFLICT DO NOTHING;
