-- PR15.8.2.5B: server-side Google Sheet settings and encrypted credential metadata.
CREATE TABLE IF NOT EXISTS catalog_sheet_integration_settings (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  credential_type TEXT NOT NULL DEFAULT 'SERVICE_ACCOUNT'
    CHECK (credential_type IN ('SERVICE_ACCOUNT')),
  encrypted_credential JSONB,
  credential_masked TEXT,
  credential_fingerprint TEXT,
  encryption_key_version TEXT,
  spreadsheet_id TEXT,
  sheet_name TEXT,
  sheet_range TEXT,
  header_row INTEGER NOT NULL DEFAULT 1 CHECK (header_row > 0),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  reference_only BOOLEAN NOT NULL DEFAULT TRUE CHECK (reference_only = TRUE),
  require_approval BOOLEAN NOT NULL DEFAULT TRUE CHECK (require_approval = TRUE),
  allow_clear_token BOOLEAN NOT NULL DEFAULT TRUE,
  clear_token TEXT NOT NULL DEFAULT '__CLEAR__',
  max_rows_per_batch INTEGER NOT NULL DEFAULT 5000 CHECK (max_rows_per_batch BETWEEN 1 AND 5000),
  sync_timeout_seconds INTEGER NOT NULL DEFAULT 30 CHECK (sync_timeout_seconds BETWEEN 1 AND 120),
  schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE CHECK (schedule_enabled = FALSE),
  status TEXT NOT NULL DEFAULT 'DISABLED'
    CHECK (status IN ('DISABLED', 'CONFIGURED', 'TESTING', 'ERROR', 'REVOKED')),
  last_test_status TEXT NOT NULL DEFAULT 'NOT_TESTED'
    CHECK (last_test_status IN ('NOT_TESTED', 'SUCCESS', 'FAILED')),
  last_test_error_code TEXT,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS catalog_sheet_integration_events (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES catalog_sheet_integration_settings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'GOOGLE_SHEET_SETTINGS_UPDATED',
    'GOOGLE_SHEET_CREDENTIAL_CREATED',
    'GOOGLE_SHEET_CREDENTIAL_ROTATED',
    'GOOGLE_SHEET_CREDENTIAL_REVOKED',
    'GOOGLE_SHEET_CONNECTION_TESTED'
  )),
  actor_id TEXT,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS catalog_sheet_integration_events_lookup_idx
  ON catalog_sheet_integration_events(integration_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_sheet_integration_singleton_idx
  ON catalog_sheet_integration_settings ((id = 'catalog_google_sheet'))
  WHERE id = 'catalog_google_sheet';

INSERT INTO catalog_sheet_integration_settings (id)
VALUES ('catalog_google_sheet')
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_permissions (name)
VALUES
  ('catalog.sheet.settings.read'),
  ('catalog.sheet.settings.write'),
  ('catalog.sheet.settings.test'),
  ('catalog.sheet.sync.preview'),
  ('catalog.sheet.sync.apply')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT r.name, p.name
FROM admin_roles r
JOIN admin_permissions p ON p.name IN (
  'catalog.sheet.settings.read',
  'catalog.sheet.settings.write',
  'catalog.sheet.settings.test',
  'catalog.sheet.sync.preview',
  'catalog.sheet.sync.apply'
)
WHERE r.name = 'catalog_manager'
ON CONFLICT DO NOTHING;
