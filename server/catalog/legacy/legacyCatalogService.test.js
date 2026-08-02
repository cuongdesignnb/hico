import assert from 'node:assert/strict';
import test from 'node:test';
import { mapLegacyCatalog } from '../catalogMapper.js';
import {
  createLegacyCatalogService,
  LegacyCatalogWriteLockedError,
} from './legacyCatalogService.js';

const raw = {
  destinations: [{
    id: 'd1',
    sku: 'D1',
    name: 'Destination',
    flag: '🇻🇳',
    dataLimit: '1 GB',
    duration: '1 Ngày',
    price: 100,
    compareAtPrice: null,
    wmproductId: 'WM-D1',
    image: '/d.webp',
    network: 'Network',
    featured: true,
    guide: 'Guide',
    variants: [{
      id: 'v1',
      sku: 'V1',
      dataLimit: '1 GB',
      duration: '1 Ngày',
      price: 100,
      compareAtPrice: null,
      wmproductId: 'WM-D1',
      simType: 'eSIM',
    }],
  }],
  packages: [],
};

const createHarness = () => {
  const env = { CATALOG_READ_SOURCE: 'legacy' };
  const destinationsStore = new Map(
    raw.destinations.map((item) => [item.id, structuredClone(item)]),
  );
  const packagesStore = new Map();
  const canonical = mapLegacyCatalog(raw);
  const manifest = {
    migrationId: 'catalog-test',
    businessChecksum: 'checksum-test',
  };
  const service = createLegacyCatalogService({
    env,
    destinationsStore,
    packagesStore,
    canonicalReader: { readCatalog: async () => canonical },
    canonicalRepository: {
      readCurrentManifest: async () => manifest,
      readCatalog: async () => ({ ...canonical, manifest }),
    },
    legacyRepository: { readLegacyCatalog: async () => raw },
    idNow: () => 123,
  });
  return { env, destinationsStore, manifest, service };
};

test('legacy mode reads and writes the existing stores', async () => {
  const { destinationsStore, service } = createHarness();
  assert.deepEqual(await service.listDestinations(), raw.destinations);
  const created = service.createDestination({
    name: 'New',
    flag: '🇯🇵',
    dataLimit: '1 GB',
    duration: '1 Ngày',
    price: '100',
    network: 'Network',
  });
  assert.equal(created.id, 'dest-123');
  assert.equal(destinationsStore.has(created.id), true);
  assert.equal(service.updateDestination(created.id, { price: '200' }).price, 200);
  assert.deepEqual(service.deleteDestination(created.id), { success: true });
});

test('canonical mode reads adapter and locks every legacy write', async () => {
  const { env, service } = createHarness();
  env.CATALOG_READ_SOURCE = 'canonical';
  assert.deepEqual(await service.listDestinations(), raw.destinations);
  const writes = [
    () => service.createDestination({}),
    () => service.updateDestination('d1', {}),
    () => service.deleteDestination('d1'),
    () => service.createPackage({}),
    () => service.updatePackage('p1', {}),
    () => service.deletePackage('p1'),
  ];
  for (const write of writes) {
    assert.throws(write, LegacyCatalogWriteLockedError);
  }
});

test('source status and rollback do not change the canonical pointer', async () => {
  const {
    env,
    destinationsStore,
    manifest,
    service,
  } = createHarness();
  env.CATALOG_READ_SOURCE = 'canonical';
  const canonicalStatus = await service.getSourceStatus();
  assert.deepEqual(canonicalStatus, {
    readSource: 'canonical',
    legacyWriteEnabled: false,
    canonicalWriteEnabled: true,
    canonicalVersion: 'catalog-test',
    canonicalChecksum: 'checksum-test',
    rollbackAvailable: true,
  });
  env.CATALOG_READ_SOURCE = 'legacy';
  service.updateDestination('d1', { name: 'Rollback edit' });
  assert.equal(destinationsStore.get('d1').name, 'Rollback edit');
  assert.equal((await service.getSourceStatus()).legacyWriteEnabled, true);
  assert.equal(manifest.migrationId, 'catalog-test');
});
