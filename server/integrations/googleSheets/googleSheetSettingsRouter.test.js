import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';

import { createGoogleSheetSettingsRouter } from './googleSheetSettingsRouter.js';
import { CatalogPreviewJobError } from '../../catalog/sheetSync/catalogPreviewJobManager.js';

const withServer = async (settingsService, sheetSyncService, callback, previewJobManager) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { user: { id: 'admin-1', email: 'admin@example.test' }, rawUser: { passwordHash: 'not-a-valid-password-hash' } };
    next();
  });
  app.use('/api/admin', createGoogleSheetSettingsRouter({ settingsService, sheetSyncService, previewJobManager }));
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

test('preview job conflict keeps its status, code, and whitelisted job id', async () => {
  const previewJobManager = {
    start: () => {
      throw new CatalogPreviewJobError('Một preview catalog khác đang chạy.', {
        code: 'CATALOG_PREVIEW_IN_PROGRESS',
        status: 409,
        details: { jobId: 'preview-123', workerPath: 'must-not-leak' },
      });
    },
  };
  await withServer({}, {}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/settings/integrations/google-sheet/preview`, { method: 'POST' });
    assert.equal(response.status, 409);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      error: 'Một preview catalog khác đang chạy.',
      code: 'CATALOG_PREVIEW_IN_PROGRESS',
      details: { jobId: 'preview-123' },
    });
  }, previewJobManager);
});

test('preview job validation and stopped errors preserve their safe contracts', async () => {
  for (const [code, status] of [['CATALOG_PREVIEW_MODE_INVALID', 422], ['CATALOG_PREVIEW_MANAGER_STOPPED', 503], ['CATALOG_PREVIEW_JOB_NOT_FOUND', 404]]) {
    const previewJobManager = {
      start: () => { throw new CatalogPreviewJobError('Preview error.', { code, status, details: { stack: 'must-not-leak' } }); },
    };
    await withServer({}, {}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/settings/integrations/google-sheet/preview`, { method: 'POST' });
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { error: 'Preview error.', code });
    }, previewJobManager);
  }
});
