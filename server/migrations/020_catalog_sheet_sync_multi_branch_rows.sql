-- HICO GỐC may produce multiple persisted branch rows from one Sheet row
-- (for example physical_sim + esim). Sheet row number is source provenance,
-- not a unique persisted row identity.

ALTER TABLE catalog_sheet_sync_rows
  DROP CONSTRAINT IF EXISTS catalog_sheet_sync_rows_batch_id_sheet_row_number_key;

-- Migration 019 intended to allow duplicate/invalid rows to remain reviewable,
-- but historical environments may still contain either constraint name.
ALTER TABLE catalog_sheet_sync_rows
  DROP CONSTRAINT IF EXISTS catalog_sheet_sync_rows_batch_id_row_hash_key;

ALTER TABLE catalog_sheet_sync_rows
  DROP CONSTRAINT IF EXISTS catalog_sheet_sync_rows_batch_row_hash_key;

-- Preserve efficient batch/source-row ordering and lookup without enforcing
-- uniqueness. Multiple branches may legitimately share one Sheet row number.
CREATE INDEX IF NOT EXISTS catalog_sheet_sync_rows_batch_sheet_row_idx
  ON catalog_sheet_sync_rows(batch_id, sheet_row_number);
