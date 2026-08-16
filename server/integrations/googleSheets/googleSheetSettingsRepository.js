import { randomUUID } from 'node:crypto';
import { GoogleSheetSettingsError } from './googleSheetSecretCrypto.js';

const ID = 'catalog_google_sheet';
const iso = (value) => value?.toISOString?.() ?? value ?? null;

const mapSettings = (row) => row ? ({
  id: row.id,
  enabled: row.enabled,
  credentialType: row.credential_type,
  encryptedCredential: row.encrypted_credential ?? null,
  credentialMasked: row.credential_masked ?? null,
  credentialFingerprint: row.credential_fingerprint ?? null,
  encryptionKeyVersion: row.encryption_key_version ?? null,
  spreadsheetId: row.spreadsheet_id ?? null,
  sheetName: row.sheet_name ?? null,
  sheetRange: row.sheet_range ?? null,
  headerRow: row.header_row,
  fieldMapping: row.field_mapping ?? null,
  priceMapping: row.price_mapping ?? null,
  headerHash: row.header_hash ?? null,
  timezone: row.timezone,
  referenceOnly: row.reference_only,
  requireApproval: row.require_approval,
  allowClearToken: row.allow_clear_token,
  clearToken: row.clear_token,
  maxRowsPerBatch: row.max_rows_per_batch,
  syncTimeoutSeconds: row.sync_timeout_seconds,
  scheduleEnabled: row.schedule_enabled,
  status: row.status,
  lastTestStatus: row.last_test_status,
  lastTestErrorCode: row.last_test_error_code ?? null,
  lastTestedAt: iso(row.last_tested_at),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  updatedBy: row.updated_by ?? null,
  version: row.version,
}) : null;

const defaultSettings = () => ({
  id: ID, enabled: false, credentialType: 'SERVICE_ACCOUNT', encryptedCredential: null,
  credentialMasked: null, credentialFingerprint: null, encryptionKeyVersion: null,
  spreadsheetId: null, sheetName: null, sheetRange: null, headerRow: 1,
  fieldMapping: null, priceMapping: null, headerHash: null,
  timezone: 'Asia/Ho_Chi_Minh', referenceOnly: true, requireApproval: true,
  allowClearToken: true, clearToken: '__CLEAR__', maxRowsPerBatch: 5000,
  syncTimeoutSeconds: 30, scheduleEnabled: false, status: 'DISABLED',
  lastTestStatus: 'NOT_TESTED', lastTestErrorCode: null, lastTestedAt: null,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: null, version: 1,
});

const assertVersion = (actual, expected) => {
  if (expected !== undefined && expected !== null && Number(expected) !== Number(actual)) {
    throw new GoogleSheetSettingsError('Google Sheet settings were changed by another Admin.', { code: 'SETTINGS_VERSION_CONFLICT', status: 409 });
  }
};

export const createInMemoryGoogleSheetSettingsRepository = ({ initial } = {}) => {
  let settings = { ...defaultSettings(), ...(initial ?? {}) };
  const events = [];
  return {
    async getSettings() { return { ...settings }; },
    async saveSettings(input) {
      assertVersion(settings.version, input.expectedVersion);
      settings = { ...settings, ...input.changes, version: settings.version + 1, updatedAt: new Date().toISOString(), updatedBy: input.actorId ?? null };
      return { ...settings };
    },
    async replaceCredential(input) {
      assertVersion(settings.version, input.expectedVersion);
      settings = { ...settings, encryptedCredential: input.encryptedCredential, credentialMasked: input.credentialMasked, credentialFingerprint: input.credentialFingerprint, encryptionKeyVersion: input.encryptionKeyVersion, status: settings.enabled ? 'CONFIGURED' : 'DISABLED', lastTestStatus: 'NOT_TESTED', lastTestErrorCode: null, lastTestedAt: null, version: settings.version + 1, updatedAt: new Date().toISOString(), updatedBy: input.actorId ?? null };
      return { ...settings };
    },
    async revokeCredential(input) {
      assertVersion(settings.version, input.expectedVersion);
      settings = { ...settings, encryptedCredential: null, credentialMasked: null, credentialFingerprint: null, encryptionKeyVersion: null, enabled: false, status: 'REVOKED', lastTestStatus: 'NOT_TESTED', lastTestErrorCode: null, lastTestedAt: null, version: settings.version + 1, updatedAt: new Date().toISOString(), updatedBy: input.actorId ?? null };
      return { ...settings };
    },
    async updateTestResult(input) {
      settings = { ...settings, lastTestStatus: input.status, lastTestErrorCode: input.errorCode ?? null, lastTestedAt: input.testedAt ?? new Date().toISOString(), status: input.status === 'SUCCESS' ? 'CONFIGURED' : 'ERROR', updatedAt: new Date().toISOString() };
      return { ...settings };
    },
    async appendEvent(input) { events.push({ id: randomUUID(), ...input, createdAt: new Date().toISOString() }); return events.at(-1); },
    async listEvents() { return [...events]; },
  };
};

export const createUnavailableGoogleSheetSettingsRepository = () => {
  const unavailable = async () => {
    throw new GoogleSheetSettingsError('Google Sheet settings require PostgreSQL.', { code: 'GOOGLE_SHEET_SETTINGS_UNAVAILABLE', status: 503 });
  };
  return {
    getSettings: unavailable,
    saveSettings: unavailable,
    replaceCredential: unavailable,
    revokeCredential: unavailable,
    updateTestResult: unavailable,
    appendEvent: unavailable,
    listEvents: unavailable,
  };
};

export const createGoogleSheetSettingsRepository = ({ pool, id = ID } = {}) => {
  if (!pool) return createUnavailableGoogleSheetSettingsRepository();
  const getSettings = async () => mapSettings((await pool.query('SELECT * FROM catalog_sheet_integration_settings WHERE id = $1', [id])).rows[0]);
  const updateWithVersion = async ({ query, values, expectedVersion }) => {
    const result = await pool.query(query, values);
    if (!result.rowCount) {
      if (expectedVersion !== undefined && expectedVersion !== null) throw new GoogleSheetSettingsError('Google Sheet settings were changed by another Admin.', { code: 'SETTINGS_VERSION_CONFLICT', status: 409 });
      throw new GoogleSheetSettingsError('Google Sheet settings are unavailable.', { code: 'GOOGLE_SHEET_SETTINGS_UNAVAILABLE', status: 503 });
    }
    return mapSettings(result.rows[0]);
  };
  return {
    getSettings,
    async saveSettings({ changes, expectedVersion, actorId }) {
      return updateWithVersion({ expectedVersion, values: [], query: `UPDATE catalog_sheet_integration_settings
        SET enabled=$1, spreadsheet_id=$2, sheet_name=$3, sheet_range=$4, header_row=$5,
            timezone=$6, field_mapping=$7::jsonb, price_mapping=$8::jsonb, header_hash=$9,
            allow_clear_token=$10, max_rows_per_batch=$11, sync_timeout_seconds=$12,
            updated_at=NOW(), updated_by=$13, version=version+1,
            status=CASE WHEN $1 THEN CASE WHEN encrypted_credential IS NULL THEN 'DISABLED' ELSE 'CONFIGURED' END ELSE 'DISABLED' END
        WHERE id='${id}' AND ($14::int IS NULL OR version=$14)
        RETURNING *`, values: [changes.enabled, changes.spreadsheetId, changes.sheetName, changes.sheetRange, changes.headerRow, changes.timezone, JSON.stringify(changes.fieldMapping ?? {}), JSON.stringify(changes.priceMapping ?? {}), changes.headerHash ?? null, changes.allowClearToken, changes.maxRowsPerBatch, changes.syncTimeoutSeconds, actorId ?? null, expectedVersion ?? null] });
    },
    async replaceCredential({ encryptedCredential, credentialMasked, credentialFingerprint, encryptionKeyVersion, expectedVersion, actorId }) {
      return updateWithVersion({ expectedVersion, values: [JSON.stringify(encryptedCredential), credentialMasked, credentialFingerprint, encryptionKeyVersion, actorId ?? null, expectedVersion ?? null], query: `UPDATE catalog_sheet_integration_settings
        SET encrypted_credential=$1::jsonb, credential_masked=$2, credential_fingerprint=$3, encryption_key_version=$4,
            last_test_status='NOT_TESTED', last_test_error_code=NULL, last_tested_at=NULL,
            status=CASE WHEN enabled THEN 'CONFIGURED' ELSE 'DISABLED' END,
            updated_at=NOW(), updated_by=$5, version=version+1
        WHERE id='${id}' AND ($6::int IS NULL OR version=$6)
        RETURNING *` });
    },
    async revokeCredential({ expectedVersion, actorId }) {
      return updateWithVersion({ expectedVersion, values: [actorId ?? null, expectedVersion ?? null], query: `UPDATE catalog_sheet_integration_settings
        SET encrypted_credential=NULL, credential_masked=NULL, credential_fingerprint=NULL, encryption_key_version=NULL,
            enabled=FALSE, status='REVOKED', last_test_status='NOT_TESTED', last_test_error_code=NULL, last_tested_at=NULL,
            updated_at=NOW(), updated_by=$1, version=version+1
        WHERE id='${id}' AND ($2::int IS NULL OR version=$2)
        RETURNING *` });
    },
    async updateTestResult({ status, errorCode, testedAt }) {
      const result = await pool.query(`UPDATE catalog_sheet_integration_settings SET last_test_status=$1, last_test_error_code=$2, last_tested_at=$3, status=$4, updated_at=NOW() WHERE id='${id}' RETURNING *`, [status, errorCode ?? null, testedAt ?? new Date().toISOString(), status === 'SUCCESS' ? 'CONFIGURED' : 'ERROR']);
      return mapSettings(result.rows[0]);
    },
    async appendEvent({ eventType, actorId, requestId, metadata = {} }) {
      const result = await pool.query('INSERT INTO catalog_sheet_integration_events (id, integration_id, event_type, actor_id, request_id, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, integration_id, event_type, actor_id, request_id, metadata, created_at', [randomUUID(), id, eventType, actorId ?? null, requestId ?? null, JSON.stringify(metadata)]);
      return result.rows[0];
    },
    async listEvents({ limit = 50 } = {}) {
      const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
      return (await pool.query('SELECT id, integration_id, event_type, actor_id, request_id, metadata, created_at FROM catalog_sheet_integration_events WHERE integration_id=$1 ORDER BY created_at DESC LIMIT $2', [id, safeLimit])).rows;
    },
  };
};

export { ID as GOOGLE_SHEET_INTEGRATION_ID, mapSettings };
