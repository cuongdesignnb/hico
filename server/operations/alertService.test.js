import assert from 'node:assert/strict';
import test from 'node:test';
import { createAlertService } from './alertService.js';

test('alert adapter emits non-sensitive operational payloads', async () => {
  let payload;
  const alert = createAlertService({ transport: async (item) => { payload = item; return { delivered: true }; }, logger: { info() {} } });
  const result = await alert.raise({ type: 'session_store_down', severity: 'critical', message: 'Session store is unavailable.', requestId: 'request-1' });
  assert.equal(result.delivered, true);
  assert.equal(payload.type, 'session_store_down');
  assert.equal(payload.requestId, 'request-1');
  assert.equal(payload.authorization, undefined);
});
