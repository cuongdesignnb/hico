import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { once } from 'node:events';
import {
  CatalogNotReadyError,
  createCatalogHealthService,
} from './catalogHealthService.js';
import { createCatalogHealthRouter, createCanonicalCatalogGuard } from './catalogHealthRouter.js';

const healthyResult = (versionId = 'catalog-1') => ({
  healthy: true,
  versionId,
  schemaVersion: 1,
  products: 1,
  variants: 1,
  checksumValid: true,
  businessChecksumValid: true,
  warnings: [],
});

const withServer = async (healthService, callback) => {
  const app = express();
  const guard = createCanonicalCatalogGuard({ catalogHealthService: healthService });
  app.use('/api', createCatalogHealthRouter({ catalogHealthService: healthService }));
  app.get('/api/catalog-products', guard, (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
};

test('health cache is invalidated and pointer changes are not hidden by stale cache', async () => {
  let calls = 0;
  let pointerVersion = 'catalog-1';
  const service = createCatalogHealthService({
    env: { CATALOG_READ_SOURCE: 'canonical', CATALOG_HEALTH_CACHE_TTL_MS: '60000' },
    validator: async () => {
      calls += 1;
      return healthyResult(pointerVersion);
    },
    canonicalRepository: { readCurrentManifest: async () => ({ versionId: pointerVersion }) },
    legacyRepository: { readLegacyCatalog: async () => ({ destinations: [], packages: [] }) },
    now: () => new Date('2026-08-01T00:00:00.000Z'),
    logger: { info() {}, error() {} },
  });
  await service.getHealth();
  await service.getHealth();
  assert.equal(calls, 1);
  pointerVersion = 'catalog-2';
  await service.getHealth();
  assert.equal(calls, 2);
  service.invalidate();
  await service.getHealth();
  assert.equal(calls, 3);
});

test('unhealthy canonical health has safe response and blocks catalog routes', async () => {
  const service = createCatalogHealthService({
    env: { CATALOG_READ_SOURCE: 'canonical' },
    validator: async () => { throw Object.assign(new Error('checksum'), { code: 'CATALOG_CHECKSUM_MISMATCH' }); },
    canonicalRepository: { readCurrentManifest: async () => null },
    legacyRepository: { readLegacyCatalog: async () => ({ destinations: [], packages: [] }) },
    logger: { info() {}, error() {} },
  });
  await assert.rejects(service.assertHealthy(), (error) => error instanceof CatalogNotReadyError && error.code === 'CATALOG_NOT_READY');
  await withServer(service, async (baseUrl) => {
    const live = await fetch(`${baseUrl}/api/health/live`);
    const ready = await fetch(`${baseUrl}/api/health/ready`);
    const catalog = await fetch(`${baseUrl}/api/health/catalog`);
    const guarded = await fetch(`${baseUrl}/api/catalog-products`);
    assert.equal(live.status, 200);
    assert.equal(ready.status, 503);
    assert.equal(catalog.status, 503);
    assert.equal(guarded.status, 503);
    assert.deepEqual(await live.json(), { status: 'alive' });
    assert.equal((await guarded.json()).code, 'CATALOG_NOT_READY');
  });
});

test('legacy source remains available for intentional rollback without canonical validation', async () => {
  let calls = 0;
  const service = createCatalogHealthService({
    env: { CATALOG_READ_SOURCE: 'legacy' },
    validator: async () => { calls += 1; return healthyResult(); },
    legacyRepository: { readLegacyCatalog: async () => ({ destinations: [{ id: 'd1', variants: [] }], packages: [] }) },
    logger: { info() {}, error() {} },
  });
  const health = await service.getHealth();
  assert.equal(health.readSource, 'legacy');
  assert.equal(health.status, 'healthy');
  assert.equal(calls, 0);
});
