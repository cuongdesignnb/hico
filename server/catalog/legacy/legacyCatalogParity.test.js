import assert from 'node:assert/strict';
import test from 'node:test';
import { mapLegacyCatalog } from '../catalogMapper.js';
import { adaptCanonicalToLegacy } from './legacyCatalogAdapter.js';
import { createLegacyCatalogParity } from './legacyCatalogParity.js';

const legacy = {
  destinations: [{
    id: 'd1',
    sku: 'D1',
    name: 'Destination',
    flag: '🇻🇳',
    dataLimit: '1 GB',
    duration: '1 Ngày',
    price: 100,
    compareAtPrice: 200,
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
      compareAtPrice: 200,
      wmproductId: 'WM-D1',
      simType: 'eSIM',
    }],
  }],
  packages: [],
};

test('parity passes with no missing IDs or changed business fields', () => {
  const adapted = adaptCanonicalToLegacy(mapLegacyCatalog(legacy));
  const report = createLegacyCatalogParity({
    legacy,
    adapted,
    startedAt: '2026-07-31T00:00:00.000Z',
    completedAt: '2026-07-31T00:00:01.000Z',
  });
  assert.equal(report.success, true);
  assert.deepEqual(report.missingDestinationIds, []);
  assert.deepEqual(report.extraDestinationIds, []);
  assert.deepEqual(report.changedProductFields, []);
  assert.deepEqual(report.changedVariantFields, []);
});

test('parity reports product, variant and ordering changes', () => {
  const adapted = adaptCanonicalToLegacy(mapLegacyCatalog(legacy));
  adapted.destinations[0].price = 101;
  adapted.destinations[0].variants[0].sku = 'CHANGED';
  adapted.destinations[0].variants.push({
    ...adapted.destinations[0].variants[0],
    id: 'extra',
  });
  const report = createLegacyCatalogParity({
    legacy,
    adapted,
    startedAt: '2026-07-31T00:00:00.000Z',
    completedAt: '2026-07-31T00:00:01.000Z',
  });
  assert.equal(report.success, false);
  assert.equal(report.changedProductFields[0].field, 'price');
  assert.equal(report.changedVariantFields.some((item) => item.field === 'sku'), true);
  assert.equal(report.changedVariantFields.some((item) => item.field === 'order'), true);
});
