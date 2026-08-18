import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';

import { createGoogleSheetSettingsRouter } from './googleSheetSettingsRouter.js';

const withServer = async (settingsService, sheetSyncService, callback) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { user: { id: 'admin-1', email: 'admin@example.test' }, rawUser: { passwordHash: 'not-a-valid-password-hash' } };
    next();
  });
  app.use('/api/admin', createGoogleSheetSettingsRouter({ settingsService, sheetSyncService }));
  const server = app.listen(0);
  await once(server, 'listening');
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); await once(server, 'close'); }
};

test('settings GET is masked, private, and no-store', async () => {
  const settingsService = {
    getPublicSettings: async () => ({
      enabled: true,
      credentialConfigured: true,
      credentialMasked: 'catalog-reader@example.test',
      credentialFingerprint: 'sha256:1234567890abcdef...',
      spreadsheetIdMasked: 'sheet...abcd',
      source: 'ADMIN_SETTINGS',
    }),
  };
  await withServer(settingsService, {}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/settings/integrations/google-sheet`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const payload = await response.json();
    assert.equal(payload.credentialMasked, 'catalog-reader@example.test');
    assert.equal(payload.privateKey, undefined);
    assert.equal(payload.credential, undefined);
  });
});

test('credential rotation and revoke use the authenticated Admin session without password re-authentication', async () => {
  let replaceCalls = 0;
  let revokeCalls = 0;
  const settingsService = {
    replaceCredential: async ({ input }) => { replaceCalls += 1; assert.equal(input.currentPassword, undefined); return { credentialConfigured: true }; },
    revokeCredential: async ({ expectedVersion }) => { revokeCalls += 1; assert.equal(expectedVersion, 1); return { credentialConfigured: false }; },
  };
  await withServer(settingsService, {}, async (baseUrl) => {
    const headers = { 'Content-Type': 'application/json' };
    const rotate = await fetch(`${baseUrl}/api/admin/settings/integrations/google-sheet/credential`, { method: 'PUT', headers, body: JSON.stringify({ credential: { client_email: 'reader@example.test' }, version: 1 }) });
    const revoke = await fetch(`${baseUrl}/api/admin/settings/integrations/google-sheet/credential`, { method: 'DELETE', headers, body: JSON.stringify({ version: 1 }) });
    assert.equal(rotate.status, 200);
    assert.equal(revoke.status, 200);
    assert.equal(replaceCalls, 1);
    assert.equal(revokeCalls, 1);
    assert.doesNotMatch(await rotate.text(), /reader@example\.test/);
  });
});
