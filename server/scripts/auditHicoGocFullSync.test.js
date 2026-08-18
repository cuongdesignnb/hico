import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptCredential } from '../integrations/googleSheets/googleSheetSecretCrypto.js';
import { cloneSeedCategories } from '../catalog/categories/catalogCategories.js';
import { runHicoGocFullSyncAudit, safeAuditError, auditMain, runtimeEnvironmentForAudit } from './auditHicoGocFullSync.js';

const encryptionKey = 'runtime-audit-test-encryption-key-0123456789';
const credential = {
  type: 'service_account',
  client_email: 'audit-sheet@example.test',
  project_id: 'hico-audit-test',
  private_key: '-----BEGIN PRIVATE KEY-----\nTEST_SECRET_KEY\n-----END PRIVATE KEY-----',
};

const headers = Array.from({ length: 25 }, (_, index) => `Header ${index + 1}`);
const sourceRow = () => {
  const row = Array(25).fill('');
  row[0] = 'Sim vật lý';
  row[1] = 'Trung Quốc 500MB/ngày';
  row[2] = '10';
  row[3] = 'Chia ngày';
  row[4] = '70000';
  row[10] = 'internet';
  row[11] = 'China Unicom';
  row[13] = 'Reset hàng ngày';
  row[15] = 'Có thể';
  row[16] = 'SKU-CN-10';
  row[23] = 'WM-CN-10';
  return row;
};

const providerOffer = { id: 'offer-1', provider: 'worldmove', wmproductId: 'WM-CN-10', providerProductType: 1, active: true, leSIM: false };

const settingsRow = ({ range = 'A1:Y2', encrypted = encryptCredential(credential, { encryptionKey }) } = {}) => ({
  id: 'catalog_google_sheet', enabled: true, credential_type: 'SERVICE_ACCOUNT', encrypted_credential: encrypted,
  credential_masked: 'audit…@…', credential_fingerprint: 'sha256:test', encryption_key_version: 'v1',
  spreadsheet_id: 'sheet-runtime-123456', sheet_name: 'HICO GỐC', sheet_range: range, header_row: 1,
  field_mapping: null, price_mapping: null, header_hash: null, timezone: 'Asia/Ho_Chi_Minh',
  reference_only: true, require_approval: true, allow_clear_token: true, max_rows_per_batch: 5000,
  sync_timeout_seconds: 30, schedule_enabled: false, status: 'CONFIGURED', last_test_status: 'SUCCESS',
  last_test_error_code: null, last_tested_at: new Date().toISOString(), version: 7,
});

const fakePool = ({ row } = {}) => {
  const queries = [];
  let ended = 0;
  return {
    queries,
    get ended() { return ended; },
    async query(sql) { queries.push(String(sql)); return { rows: row ? [row] : [] }; },
    async end() { ended += 1; },
  };
};

const dependencies = ({ row = settingsRow(), range = 'A1:Y2' } = {}) => {
  const pool = fakePool({ row: row ? { ...row, sheet_range: range } : null });
  const client = {
    receivedCredential: null,
    receivedSettings: null,
    async readRows({ credential: receivedCredential, settings }) {
      this.receivedCredential = receivedCredential;
      this.receivedSettings = settings;
      return { spreadsheetId: settings.spreadsheetId, sheetTab: settings.sheetName, sheetRange: settings.sheetRange, values: [headers, sourceRow()] };
    },
  };
  return {
    pool,
    client,
    poolFactory: async () => pool,
    clientFactoryFactory: () => client,
    canonicalRepositoryFactory: () => ({ readCatalog: async () => ({ products: [], variants: [], categories: cloneSeedCategories(), manifest: { versionId: 'catalog-current' } }) }),
    providerRepositoryFactory: () => ({ listOffers: async () => [providerOffer] }),
  };
};

const runtimeEnv = { DATABASE_URL: 'postgres://audit-test', INTEGRATION_SETTINGS_ENCRYPTION_KEY: encryptionKey };

test('audit uses Admin Settings and encrypted credential when legacy env is absent', async () => {
  const deps = dependencies();
  const result = await runHicoGocFullSyncAudit({ env: runtimeEnv, ...deps });
  assert.equal(result.configSource, 'ADMIN_SETTINGS');
  assert.equal(result.config.credentialConfigured, true);
  assert.equal(result.config.spreadsheetIdMasked, 'shee…3456');
  assert.equal(result.source.range, 'A1:Y2');
  assert.equal(result.mapping.requiredLastColumn, 'Y');
  assert.equal(result.source.rowsRead, 1);
  assert.equal(result.parser.rowsParsed, 1);
  assert.equal(result.candidate.products, 1);
  assert.equal(result.candidate.variants, 1);
  assert.equal(deps.client.receivedCredential.private_key, credential.private_key);
  assert.equal(JSON.stringify(result).includes('TEST_SECRET_KEY'), false);
  assert.equal(deps.pool.ended, 1);
  assert.equal(deps.pool.queries.every((query) => query.trimStart().toUpperCase().startsWith('SELECT')), true);
});

test('audit does not use legacy env unless explicitly enabled', () => {
  const sanitized = runtimeEnvironmentForAudit({ env: { ...runtimeEnv, CATALOG_SHEET_ID: 'legacy', GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON: 'secret' } });
  assert.equal(sanitized.CATALOG_SHEET_ID, undefined);
  assert.equal(sanitized.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON, undefined);
  const legacy = runtimeEnvironmentForAudit({ env: { ...runtimeEnv, CATALOG_SHEET_ID: 'legacy' }, allowLegacyEnv: true });
  assert.equal(legacy.CATALOG_SHEET_ID, 'legacy');
});

test('Admin Settings remains the source of truth when legacy env values are present', async () => {
  const deps = dependencies();
  const result = await runHicoGocFullSyncAudit({
    env: { ...runtimeEnv, CATALOG_SHEET_ID: 'legacy-sheet', CATALOG_SHEET_TAB: 'Legacy', CATALOG_SHEET_RANGE: 'A1:K2', GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON: 'legacy-secret' },
    ...deps,
  });
  assert.equal(result.configSource, 'ADMIN_SETTINGS');
  assert.equal(result.config.spreadsheetIdMasked, 'shee…3456');
  assert.equal(deps.client.receivedSettings.spreadsheetId, 'sheet-runtime-123456');
  assert.equal(deps.pool.ended, 1);
});

test('audit reports missing Admin settings without writing', async () => {
  const deps = dependencies({ row: null });
  await assert.rejects(
    () => runHicoGocFullSyncAudit({ env: runtimeEnv, ...deps }),
    (error) => error.code === 'GOOGLE_SHEET_NOT_CONFIGURED',
  );
  const safe = safeAuditError(Object.assign(new Error('not configured'), { code: 'GOOGLE_SHEET_NOT_CONFIGURED' }));
  assert.equal(safe.code, 'READ_ONLY_REAL_SHEET_AUDIT_BLOCKED_LOCAL');
  assert.equal(safe.reasonCode, 'SHEET_SYNC_NOT_CONFIGURED');
  assert.equal(deps.pool.ended, 1);
  assert.equal(deps.pool.queries.every((query) => query.trimStart().toUpperCase().startsWith('SELECT')), true);
});

test('audit maps encrypted credential failures without exposing credential data', async () => {
  const deps = dependencies({ row: settingsRow({ encrypted: encryptCredential(credential, { encryptionKey: 'different-encryption-key-0123456789' }) }) });
  await assert.rejects(() => runHicoGocFullSyncAudit({ env: runtimeEnv, ...deps }), (error) => error.code === 'GOOGLE_SHEET_SECRET_DECRYPT_FAILED');
  const safe = safeAuditError(Object.assign(new Error('private_key TEST_SECRET_KEY'), { code: 'GOOGLE_SHEET_SECRET_DECRYPT_FAILED', details: { private_key: 'TEST_SECRET_KEY' } }));
  assert.equal(safe.code, 'INTEGRATION_CREDENTIAL_UNAVAILABLE');
  assert.equal(JSON.stringify(safe).includes('TEST_SECRET_KEY'), false);
  assert.equal(JSON.stringify(safe).includes('private_key'), false);
  assert.equal(deps.pool.ended, 1);
});

test('audit blocks an incomplete runtime range before parser/build', async () => {
  const deps = dependencies({ range: 'A1:K2' });
  await assert.rejects(() => runHicoGocFullSyncAudit({ env: runtimeEnv, ...deps }), (error) => error.code === 'SHEET_RANGE_INCOMPLETE');
  assert.equal(deps.client.receivedCredential !== null, true);
  assert.equal(deps.pool.ended, 1);
});

test('audit stdout stays secret-free for unexpected errors', async () => {
  let output = '';
  const exitCode = await auditMain({
    run: async () => { throw Object.assign(new Error('private_key TEST_SECRET_KEY'), { code: 'UNEXPECTED', details: { private_key: 'TEST_SECRET_KEY' } }); },
    write: (value) => { output += value; },
  });
  assert.equal(exitCode, 1);
  assert.equal(output.includes('TEST_SECRET_KEY'), false);
  assert.equal(output.includes('private_key'), false);
  assert.match(output, /READ_ONLY_AUDIT_FAILED/);
});
