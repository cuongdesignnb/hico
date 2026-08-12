import { randomUUID } from 'node:crypto';
import { SePaySettingsError } from './sepayErrors.js';

const ID = 'sepay';
const iso = (value) => value?.toISOString?.() ?? value ?? null;

const mapSettings = (row) => row ? ({
  id: row.id,
  provider: row.provider,
  enabled: row.enabled,
  bankAccountMasked: row.bank_account_masked ?? null,
  bankAccountHash: row.bank_account_hash ?? null,
  accountHolder: row.account_holder ?? null,
  bankName: row.bank_name ?? null,
  orderReferencePrefix: row.order_reference_prefix,
  webhookPath: row.webhook_path,
  encryptedCredential: row.encrypted_credential ?? null,
  credentialMasked: row.credential_masked ?? null,
  credentialFingerprint: row.credential_fingerprint ?? null,
  encryptionKeyVersion: row.encryption_key_version ?? null,
  status: row.status,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  updatedBy: row.updated_by ?? null,
  version: row.version,
}) : null;

const defaultSettings = () => ({
  id: ID,
  provider: 'SEPAY',
  enabled: false,
  bankAccountMasked: null,
  bankAccountHash: null,
  accountHolder: null,
  bankName: null,
  orderReferencePrefix: 'HICO',
  webhookPath: '/api/webhooks/sepay',
  encryptedCredential: null,
  credentialMasked: null,
  credentialFingerprint: null,
  encryptionKeyVersion: null,
  status: 'DISABLED',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  updatedBy: null,
  version: 1,
});

const assertVersion = (actual, expected) => {
  if (expected !== undefined && expected !== null && Number(expected) !== Number(actual)) {
    throw new SePaySettingsError('Cài đặt SePay đã được Admin khác thay đổi.', { code: 'SETTINGS_VERSION_CONFLICT', status: 409 });
  }
};

export const createInMemorySePaySettingsRepository = ({ initial } = {}) => {
  let settings = { ...defaultSettings(), ...(initial ?? {}) };
  const events = [];
  return {
    async getSettings() { return { ...settings }; },
    async saveSettings({ changes, expectedVersion, actorId }) {
      assertVersion(settings.version, expectedVersion);
      settings = { ...settings, ...changes, version: settings.version + 1, updatedAt: new Date().toISOString(), updatedBy: actorId ?? null };
      return { ...settings };
    },
    async replaceCredential({ encryptedCredential, credentialMasked, credentialFingerprint, encryptionKeyVersion, expectedVersion, actorId }) {
      assertVersion(settings.version, expectedVersion);
      settings = { ...settings, encryptedCredential, credentialMasked, credentialFingerprint, encryptionKeyVersion, status: settings.enabled ? 'CONFIGURED' : 'DISABLED', version: settings.version + 1, updatedAt: new Date().toISOString(), updatedBy: actorId ?? null };
      return { ...settings };
    },
    async appendEvent(input) { events.push({ id: randomUUID(), ...input, createdAt: new Date().toISOString() }); return events.at(-1); },
    async listEvents() { return [...events]; },
  };
};

export const createUnavailableSePaySettingsRepository = () => {
  const unavailable = async () => { throw new SePaySettingsError('SePay settings yêu cầu PostgreSQL.', { code: 'SEPAY_SETTINGS_UNAVAILABLE', status: 503 }); };
  return { getSettings: unavailable, saveSettings: unavailable, replaceCredential: unavailable, appendEvent: unavailable, listEvents: unavailable };
};

export const createSePaySettingsRepository = ({ pool } = {}) => {
  if (!pool) return createUnavailableSePaySettingsRepository();
  const getSettings = async () => mapSettings((await pool.query('SELECT * FROM payment_integration_settings WHERE id = $1', [ID])).rows[0]);
  const updateWithVersion = async ({ query, values, expectedVersion }) => {
    const result = await pool.query(query, values);
    if (!result.rowCount) {
      if (expectedVersion !== undefined && expectedVersion !== null) throw new SePaySettingsError('Cài đặt SePay đã được Admin khác thay đổi.', { code: 'SETTINGS_VERSION_CONFLICT', status: 409 });
      throw new SePaySettingsError('Cài đặt SePay không khả dụng.', { code: 'SEPAY_SETTINGS_UNAVAILABLE', status: 503 });
    }
    return mapSettings(result.rows[0]);
  };
  return {
    getSettings,
    async saveSettings({ changes, expectedVersion, actorId }) {
      return updateWithVersion({ expectedVersion, values: [changes.enabled, changes.bankAccountMasked, changes.bankAccountHash, changes.accountHolder, changes.bankName, changes.orderReferencePrefix, actorId ?? null, expectedVersion ?? null], query: `UPDATE payment_integration_settings SET enabled=$1, bank_account_masked=$2, bank_account_hash=$3, account_holder=$4, bank_name=$5, order_reference_prefix=$6, status=CASE WHEN $1 THEN CASE WHEN encrypted_credential IS NULL THEN 'DISABLED' ELSE 'CONFIGURED' END ELSE 'DISABLED' END, updated_at=NOW(), updated_by=$7, version=version+1 WHERE id='${ID}' AND ($8::int IS NULL OR version=$8) RETURNING *` });
    },
    async replaceCredential({ encryptedCredential, credentialMasked, credentialFingerprint, encryptionKeyVersion, expectedVersion, actorId }) {
      return updateWithVersion({ expectedVersion, values: [JSON.stringify(encryptedCredential), credentialMasked, credentialFingerprint, encryptionKeyVersion, actorId ?? null, expectedVersion ?? null], query: `UPDATE payment_integration_settings SET encrypted_credential=$1::jsonb, credential_masked=$2, credential_fingerprint=$3, encryption_key_version=$4, status=CASE WHEN enabled THEN 'CONFIGURED' ELSE 'DISABLED' END, updated_at=NOW(), updated_by=$5, version=version+1 WHERE id='${ID}' AND ($6::int IS NULL OR version=$6) RETURNING *` });
    },
    async appendEvent({ eventType, actorId, requestId, metadata = {} }) {
      const result = await pool.query('INSERT INTO payment_webhook_events (id, provider, provider_event_id, payload_hash, status, metadata, received_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING id, provider, provider_event_id, payload_hash, status, metadata, received_at', [randomUUID(), 'SEPAY', `admin:${requestId ?? randomUUID()}`, null, eventType, JSON.stringify({ actorId, ...metadata })]);
      return result.rows[0];
    },
    async listEvents({ limit = 50 } = {}) {
      const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
      return (await pool.query('SELECT id, provider, provider_event_id, payload_hash, status, metadata, received_at FROM payment_webhook_events WHERE provider=$1 ORDER BY received_at DESC LIMIT $2', ['SEPAY', safeLimit])).rows;
    },
  };
};

export { ID as SEPAY_SETTINGS_ID, mapSettings, defaultSettings };
