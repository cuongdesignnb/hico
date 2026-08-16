-- HICO GỐC quick-sync mapping is configuration metadata, not Sheet data.
ALTER TABLE catalog_sheet_integration_settings
  ADD COLUMN IF NOT EXISTS field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS price_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS header_hash TEXT;

COMMENT ON COLUMN catalog_sheet_integration_settings.field_mapping IS 'Zero-based HICO GỐC semantic column mapping.';
COMMENT ON COLUMN catalog_sheet_integration_settings.price_mapping IS 'Selected public selling and optional comparison price columns.';
COMMENT ON COLUMN catalog_sheet_integration_settings.header_hash IS 'SHA-256 of the normalized HICO GỐC header row.';

ALTER TABLE catalog_sheet_sync_batches
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS field_mapping JSONB,
  ADD COLUMN IF NOT EXISTS price_mapping JSONB,
  ADD COLUMN IF NOT EXISTS header_hash TEXT,
  ADD COLUMN IF NOT EXISTS provider_snapshot_hash TEXT;

-- Invalid duplicate rows must remain visible in the review batch instead of
-- failing persistence before Admin can resolve them.
DROP INDEX IF EXISTS catalog_sheet_sync_rows_batch_variant_idx;
ALTER TABLE catalog_sheet_sync_rows
  DROP CONSTRAINT IF EXISTS catalog_sheet_sync_rows_batch_row_hash_key;
