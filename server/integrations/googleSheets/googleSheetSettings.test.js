import test from 'node:test';
import assert from 'node:assert/strict';
import {
  credentialFingerprint,
  decryptCredential,
  encryptCredential,
  maskServiceAccountEmail,
  maskSpreadsheetId,
  validateServiceAccountCredential,
} from './googleSheetSecretCrypto.js';
import { createInMemoryGoogleSheetSettingsRepository } from './googleSheetSettingsRepository.js';
import { createGoogleSheetCredentialRepository } from './googleSheetCredentialRepository.js';
import { createGoogleSheetConnectionService } from './googleSheetConnectionService.js';

const key = 'integration-settings-test-key-0123456789';
const credential = {
  type: 'service_account', client_email: 'hico-sheet-sync@example.test', project_id: 'hico-test',
  private_key: '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----',
};

test('encrypts service account without returning plaintext', () => {
  const encrypted = encryptCredential(credential, { encryptionKey: key });
  assert.equal(JSON.stringify(encrypted).includes('hico-sheet-sync@example.test'), false);
  assert.deepEqual(decryptCredential(encrypted, { encryptionKey: key }), { ...credential, token_uri: 'https://oauth2.googleapis.com/token' });
  assert.match(credentialFingerprint(validateServiceAccountCredential(credential)), /^sha256:[a-f0-9]{64}$/);
  assert.equal(maskServiceAccountEmail(credential.client_email), 'hico…@…');
  assert.equal(maskSpreadsheetId('1234567890'), '1234…7890');
});

test('rejects invalid credential and weak encryption key', () => {
  assert.throws(() => validateServiceAccountCredential('{"type":"service_account"}'), (error) => error.code === 'GOOGLE_SHEET_CREDENTIAL_INVALID');
  assert.throws(() => encryptCredential(credential, { encryptionKey: 'short' }), (error) => error.code === 'GOOGLE_SHEET_ENCRYPTION_KEY_REQUIRED');
});

test('settings API surface is masked and rotates atomically after connection test', async () => {
  const repository = createInMemoryGoogleSheetSettingsRepository();
  const credentials = createGoogleSheetCredentialRepository({ settingsRepository: repository, env: { INTEGRATION_SETTINGS_ENCRYPTION_KEY: key } });
  const service = createGoogleSheetConnectionService({
    settingsRepository: repository,
    credentialRepository: credentials,
    clientFactory: {
      async testConnection() { return { spreadsheetTitle: 'HICO QA', sheetName: 'HICO_SYNC', range: 'A1:K3', headerColumns: ['variant_id', 'retail_price'], rowsSampled: 2, checkedAt: new Date().toISOString() }; },
      async readRows() { return { spreadsheetId: 'sheet-id', sheetTab: 'HICO_SYNC', sheetRange: 'A1:K3', values: [['variant_id'], ['variant-a']] }; },
    },
    env: { INTEGRATION_SETTINGS_ENCRYPTION_KEY: key },
  });
  const saved = await service.saveSettings({ input: { enabled: true, spreadsheetId: 'sheet-id-123456', sheetName: 'HICO_SYNC', sheetRange: 'A1:K3' }, actorId: 'admin-1' });
  const rotated = await service.replaceCredential({ input: { credential: JSON.stringify(credential) }, expectedVersion: saved.version, actorId: 'admin-1' });
  assert.equal(rotated.settings.credentialConfigured, true);
  assert.equal(rotated.settings.spreadsheetIdMasked, 'shee…3456');
  assert.equal(rotated.settings.credentialMasked, 'hico…@…');
  assert.equal(JSON.stringify(rotated).includes('private_key'), false);
  assert.equal((await service.testConnection({ actorId: 'admin-1' })).status, 'SUCCESS');
  await assert.rejects(() => service.revokeCredential({ expectedVersion: rotated.settings.version, actorId: 'admin-1' }), (error) => error.code === 'ADMIN_REAUTH_REQUIRED');
  const revoked = await service.revokeCredential({ expectedVersion: rotated.settings.version, actorId: 'admin-1', currentPasswordVerified: true });
  assert.equal(revoked.credentialConfigured, false);
  await assert.rejects(() => service.readRows(), (error) => error.code === 'GOOGLE_SHEET_NOT_CONFIGURED');
});

test('settings changes reject non-reference or scheduled modes', async () => {
  const repository = createInMemoryGoogleSheetSettingsRepository();
  const service = createGoogleSheetConnectionService({ settingsRepository: repository, env: {} });
  await assert.rejects(() => service.saveSettings({ input: { referenceOnly: false } }), (error) => error.code === 'GOOGLE_SHEET_GUARDRAIL_REQUIRED');
  await assert.rejects(() => service.saveSettings({ input: { scheduleEnabled: true } }), (error) => error.code === 'GOOGLE_SHEET_SCHEDULE_UNAVAILABLE');
});
