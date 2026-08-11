-- PR15.8.2.5A: read-only Sheet staging and approved catalog synchronization.
CREATE TABLE IF NOT EXISTS catalog_sheet_sync_batches (
  id TEXT PRIMARY KEY,
  source_hash TEXT NOT NULL UNIQUE,
  spreadsheet_id TEXT NOT NULL,
  sheet_tab TEXT NOT NULL,
  sheet_range TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  approved_by TEXT,
  apply_command_id TEXT UNIQUE,
  apply_started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  catalog_version_id TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS catalog_sheet_sync_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES catalog_sheet_sync_batches(id) ON DELETE CASCADE,
  sheet_row_number INTEGER NOT NULL,
  row_hash TEXT NOT NULL,
  variant_id TEXT,
  status TEXT NOT NULL,
  normalized_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  applied_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  UNIQUE(batch_id, sheet_row_number),
  UNIQUE(batch_id, row_hash)
);

ALTER TABLE catalog_sheet_sync_batches
  ADD CONSTRAINT catalog_sheet_sync_status_check
  CHECK (status IN ('FETCHED', 'VALIDATED', 'READY_FOR_REVIEW', 'APPLYING', 'APPLIED', 'PARTIALLY_APPLIED', 'REJECTED', 'FAILED'));

CREATE INDEX IF NOT EXISTS catalog_sheet_sync_batches_status_created_idx
  ON catalog_sheet_sync_batches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS catalog_sheet_sync_rows_batch_status_idx
  ON catalog_sheet_sync_rows(batch_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_sheet_sync_rows_batch_variant_idx
  ON catalog_sheet_sync_rows(batch_id, variant_id)
  WHERE variant_id IS NOT NULL;

ALTER TABLE catalog_sheet_sync_rows
  ADD CONSTRAINT catalog_sheet_sync_row_status_check
  CHECK (status IN ('VALID', 'INVALID', 'APPLIED', 'SKIPPED'));

INSERT INTO admin_permissions (name)
VALUES ('catalog.sheet_sync')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT r.name, 'catalog.sheet_sync'
FROM admin_roles r
WHERE r.name = 'catalog_manager'
ON CONFLICT DO NOTHING;
