import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyProductionSecrets } from './verifyProductionSecrets.js';
import { requiredAlertNames, verifyProductionAlerts } from './verifyProductionAlerts.js';
import { validateProductionLaunch } from './validateProductionLaunch.js';
import { createProductionReadinessService } from '../production/productionReadinessService.js';

const secretMetadata = {
  secrets: ['worldmove_credential', 'worldmove_webhook', 'session_cookie', 'csrf_key', 'postgres_credential', 'backup_encryption', 'alert_provider'].map((name) => ({
    name, configured: true, version: 'v2', rotatedAt: '2026-08-01T00:00:00.000Z', oldVersionRevokedAt: '2026-08-01T01:00:00.000Z', owner: 'Security',
  })),
};

test('production secret verification requires rotation and revocation metadata without exposing values', async () => {
  const result = await verifyProductionSecrets({
    env: {
      SECRET_ROTATION_METADATA_PATH: 'managed://hico-secrets',
      WORLDMOVE_TOKEN: 'x'.repeat(32), WORLDMOVE_WEBHOOK_SECRET: 'x'.repeat(32), SESSION_SECRET: 'x'.repeat(32), CSRF_SECRET: 'x'.repeat(32),
      DATABASE_URL: 'postgres://managed', BACKUP_ENCRYPTION_KEY: 'x'.repeat(32), ALERT_WEBHOOK_URL: 'https://alerts.internal.test',
      PRODUCTION_SECURITY_OWNER: 'Security', PRODUCTION_SECURITY_APPROVER: 'Approver',
    },
    readFile: async () => JSON.stringify(secretMetadata),
  });
  assert.equal(result.status, 'verified');
  assert.equal(Object.hasOwn(result, 'WORLDMOVE_TOKEN'), false);
  assert.equal(result.secrets[0].version, 'v2');
});

test('production alert verification requires every alert to be externally delivered and acknowledged', async () => {
  const document = {
    channel: 'managed-alerts', onCall: 'primary', backupOnCall: 'backup', runbookBaseUrl: 'https://runbooks.internal.test', owner: 'Operations', approver: 'Approver', acknowledgedAt: '2026-08-01T02:00:00.000Z',
    events: requiredAlertNames.map((name) => ({ name, generated: true, delivered: true, acknowledged: true, testedAt: '2026-08-01T02:00:00.000Z' })),
  };
  const result = await verifyProductionAlerts({ env: { ALERT_DELIVERY_EVIDENCE_PATH: 'managed://alerts' }, readFile: async () => JSON.stringify(document) });
  assert.equal(result.status, 'verified');
  assert.equal(result.channel, 'managed-alerts');
});

test('production launch validation remains fail-closed without explicit approval and evidence', async () => {
  const result = await validateProductionLaunch({ env: {}, environmentValidator: async () => ({ ready: true, blockers: [] }), secretsValidator: async () => ({ status: 'verified' }), alertsValidator: async () => ({ status: 'verified' }) });
  assert.equal(result.status, 'not_ready');
  assert.equal(result.writesEnabled, false);
  assert.ok(result.blockers.includes('PRODUCTION_DOMAIN_EVIDENCE_PATH_REQUIRED'));
  assert.ok(result.blockers.includes('PRODUCTION_LAUNCH_APPROVAL_REQUIRED'));
});

test('production readiness exposes safe check counts and keeps writes disabled when a check fails', async () => {
  const service = createProductionReadinessService({ checks: async () => ({ production: true, checks: [{ name: 'A', passed: true }, { name: 'B', passed: false }], failedChecks: ['B'] }) });
  const result = await service.evaluate({ force: true });
  assert.equal(result.status, 'not_ready');
  assert.equal(result.writesEnabled, false);
  assert.equal(result.criticalChecksPassed, 1);
  assert.equal(result.criticalChecksTotal, 2);
});
