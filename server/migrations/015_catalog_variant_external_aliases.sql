-- PR15.8.2.5B.5: explicit Sheet SKU -> canonical variant identity aliases.
-- Canonical products/variants are currently versioned JSON, so referential integrity
-- is enforced by the alias service against the active canonical snapshot. No fake FK.
CREATE TABLE IF NOT EXISTS catalog_variant_external_aliases (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL CHECK (namespace IN ('SIM_HICO_SKU_ESIM', 'SIM_HICO_SKU_PHYSICAL')),
  external_key TEXT NOT NULL,
  normalized_external_key TEXT NOT NULL,
  medium TEXT NOT NULL CHECK (medium IN ('esim', 'physical_sim')),
  variant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((namespace = 'SIM_HICO_SKU_ESIM' AND medium = 'esim') OR (namespace = 'SIM_HICO_SKU_PHYSICAL' AND medium = 'physical_sim'))
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_variant_external_aliases_key
  ON catalog_variant_external_aliases(namespace, normalized_external_key, medium);
CREATE INDEX IF NOT EXISTS catalog_variant_external_aliases_variant_idx
  ON catalog_variant_external_aliases(variant_id, status);
CREATE TABLE IF NOT EXISTS catalog_variant_external_alias_events (
  id BIGSERIAL PRIMARY KEY,
  alias_id TEXT NOT NULL REFERENCES catalog_variant_external_aliases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATE', 'REMAP', 'REVOKE')),
  actor_id TEXT,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO admin_permissions (name) VALUES ('catalog.sheet.reconcile.read'), ('catalog.sheet.reconcile.write') ON CONFLICT (name) DO NOTHING;
INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'catalog_manager', name FROM admin_permissions WHERE name IN ('catalog.sheet.reconcile.read', 'catalog.sheet.reconcile.write')
ON CONFLICT DO NOTHING;
