CREATE TABLE IF NOT EXISTS customer_data_quarantine (
  id UUID PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('DEMO_PROFILE', 'MOCK_ESIM', 'MOCK_MANUAL_QR', 'LEGACY_ORDER_UNRESOLVED', 'OWNER_CONFLICT', 'MISSING_FULFILLMENT', 'INVALID_ASSET_REFERENCE', 'DUPLICATE_CUSTOMER_CONTACT')),
  source_reference TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUARANTINED' CHECK (status IN ('QUARANTINED', 'MANUAL_REVIEW', 'RESOLVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  resolution TEXT,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_type, source_reference)
);

CREATE INDEX IF NOT EXISTS customer_data_quarantine_status_idx
  ON customer_data_quarantine (status, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_data_quarantine_reason_idx
  ON customer_data_quarantine (reason_code, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_data_quarantine_safe_metadata_check'
  ) THEN
    ALTER TABLE customer_data_quarantine
      ADD CONSTRAINT customer_data_quarantine_safe_metadata_check
      CHECK (
        NOT (metadata_jsonb ?| ARRAY[
          'email', 'phone', 'address', 'password', 'passwordHash', 'token',
          'tokenHash', 'secret', 'qrcode', 'qrcodeContent', 'lpa', 'pin', 'puk',
          'iccid', 'redemptionCode'
        ])
      );
  END IF;
END $$;
