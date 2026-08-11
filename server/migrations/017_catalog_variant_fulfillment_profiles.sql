-- PR15.8.2.5B.10: structured canonical fulfillment-family profiles.
-- Legacy catalog fulfillmentMethod remains unchanged; this profile is the
-- provider eligibility contract used by the resolver and checkout.
CREATE TABLE IF NOT EXISTS catalog_variant_fulfillment_profiles (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('WORLDMOVE')),
  region_code TEXT NOT NULL,
  medium TEXT NOT NULL CHECK (medium IN ('ESIM', 'PHYSICAL_SIM')),
  data_policy TEXT NOT NULL,
  speed_policy TEXT NOT NULL,
  network_policy TEXT,
  activation_policy TEXT,
  reset_policy TEXT,
  operation_type TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  family_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'REVOKED')),
  source TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_variant_fulfillment_profiles_active_key
  ON catalog_variant_fulfillment_profiles(variant_id, provider)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS catalog_variant_fulfillment_profiles_family_idx
  ON catalog_variant_fulfillment_profiles(provider, family_key, status);

CREATE INDEX IF NOT EXISTS catalog_variant_fulfillment_profiles_variant_idx
  ON catalog_variant_fulfillment_profiles(variant_id, provider, status);

CREATE TABLE IF NOT EXISTS catalog_variant_fulfillment_profile_events (
  id BIGSERIAL PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES catalog_variant_fulfillment_profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATE', 'UPDATE', 'REVOKE')),
  actor_id TEXT,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
