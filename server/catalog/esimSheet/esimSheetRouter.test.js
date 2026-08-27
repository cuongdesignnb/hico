import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { createEsimSheetRouter } from './esimSheetRouter.js';

test('eSIM Sheet config status is safe and audit remains read-only', async () => {
  const app = express();
  const auditCalls = [];
  app.use('/api', createEsimSheetRouter({
    env: {},
    auditService: { audit: async (input) => { auditCalls.push(input); return { source: 'HICO_ESIM_SHEET', rowsRead: 0 }; } },
  }));
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const status = await fetch(`${baseUrl}/api/admin/esim-sheet/config`);
    assert.equal(status.status, 200);
    assert.equal((await status.json()).configured, false);
    const audit = await fetch(`${baseUrl}/api/admin/esim-sheet/audit`);
    assert.equal(audit.status, 200);
    assert.deepEqual(await audit.json(), { source: 'HICO_ESIM_SHEET', rowsRead: 0 });
    assert.deepEqual(auditCalls, [{ mapping: {} }]);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('eSIM Sheet audit reports missing configuration without a provider call', async () => {
  const app = express();
  app.use('/api', createEsimSheetRouter({ env: {}, auditService: { audit: async () => { throw Object.assign(new Error('eSIM Sheet source is not configured.'), { code: 'ESIM_SHEET_NOT_CONFIGURED', status: 503, details: { missing: ['ESIM_SHEET_ID'] } }); } } }));
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/esim-sheet/audit`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'eSIM Sheet source is not configured.', code: 'ESIM_SHEET_NOT_CONFIGURED', details: { missing: ['ESIM_SHEET_ID'] } });
  } finally {
    server.close();
    await once(server, 'close');
  }
});
