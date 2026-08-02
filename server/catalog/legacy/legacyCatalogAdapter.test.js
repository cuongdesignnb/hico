import assert from 'node:assert/strict';
import test from 'node:test';
import { mapLegacyCatalog } from '../catalogMapper.js';
import { adaptCanonicalToLegacy } from './legacyCatalogAdapter.js';
import { adaptLegacyVariant } from './legacyVariantAdapter.js';

const legacy = {
  destinations: [{
    id: 'dest-1',
    sku: 'DEST-1',
    name: 'Nhật Bản',
    flag: '🇯🇵',
    dataLimit: '5 GB',
    duration: '7 Ngày',
    price: 250000,
    compareAtPrice: 300000,
    wmproductId: 'WM-1',
    image: '/jp.webp',
    network: 'Docomo',
    featured: true,
    guide: '<p>Guide</p>',
    seoTitle: 'SEO',
    seoDescription: 'Description',
    seoKeywords: 'keywords',
    variants: [{
      id: 'variant-1',
      sku: 'DUPLICATE-SKU',
      dataLimit: '5 GB',
      duration: '7 Ngày',
      price: 250000,
      compareAtPrice: 300000,
      wmproductId: 'WM-1',
      simType: 'leSIM',
    }, {
      id: 'variant-2',
      sku: 'DUPLICATE-SKU',
      dataLimit: '10 GB',
      duration: '15 Ngày',
      price: 450000,
      compareAtPrice: null,
      wmproductId: 'WM-2',
      simType: 'manual',
      leSIM: false,
    }],
  }],
  packages: [{
    id: 'package-1',
    sku: 'PACKAGE-1',
    name: 'Toàn cầu',
    coverage: '85 Quốc gia',
    dataLimit: '10 GB',
    duration: '30 Ngày',
    price: 900000,
    compareAtPrice: 1000000,
    wmproductId: 'WM-GLOBAL',
    network: 'Global',
    description: '<p>Package</p>',
    featured: true,
    iconType: 'global',
    variants: [{
      id: 'variant-3',
      sku: 'PACKAGE-VARIANT',
      dataLimit: '10 GB',
      duration: '30 Ngày',
      price: 900000,
      compareAtPrice: 1000000,
      wmproductId: 'WM-GLOBAL',
      simType: 'physical',
    }],
  }],
};

test('projects destination and global package with exact legacy contract', () => {
  const canonical = mapLegacyCatalog(legacy);
  const adapted = adaptCanonicalToLegacy(canonical);
  assert.deepEqual(adapted.destinations, legacy.destinations);
  assert.deepEqual(adapted.packages, legacy.packages);
  assert.deepEqual(adapted.diagnostics, {
    unsupportedLegacyProjection: [],
    classificationConflicts: [],
  });
});

test('keeps duplicate SKU values and deterministic ordering unchanged', () => {
  const adapted = adaptCanonicalToLegacy(mapLegacyCatalog(legacy));
  assert.deepEqual(
    adapted.destinations[0].variants.map((variant) => variant.id),
    ['variant-1', 'variant-2'],
  );
  assert.deepEqual(
    adapted.destinations[0].variants.map((variant) => variant.sku),
    ['DUPLICATE-SKU', 'DUPLICATE-SKU'],
  );
});

test('uses safe fulfillment fallback only when legacy simType is absent', () => {
  const cases = [
    ['WORLDMOVE_ESIM_REDEEM', 'leSIM'],
    ['WORLDMOVE_ESIM_ORDER_THEN_REDEEM', 'eSIM'],
    ['HICO_MANUAL_QR', 'manual'],
    ['HICO_PHYSICAL_STOCK', 'physical'],
    ['WORLDMOVE_PHYSICAL_ORDER', 'physical'],
  ];
  for (const [fulfillmentMethod, expected] of cases) {
    const adapted = adaptLegacyVariant({
      id: `variant-${expected}`,
      productId: 'p1',
      sku: 'SKU',
      price: 1,
      fulfillmentMethod,
    });
    assert.equal(adapted.variant.simType, expected);
  }
});

test('does not project top-up or device products into legacy catalog', () => {
  const topup = mapLegacyCatalog({
    destinations: [{
      ...legacy.destinations[0],
      operation: 'topup',
    }],
    packages: [],
  });
  const device = {
    products: [{
      ...topup.products[0],
      id: 'device-1',
      operation: 'device_sale',
    }],
    variants: [],
  };
  assert.equal(adaptCanonicalToLegacy(topup).destinations.length, 0);
  assert.equal(
    adaptCanonicalToLegacy(topup).diagnostics.unsupportedLegacyProjection.length,
    1,
  );
  assert.equal(adaptCanonicalToLegacy(device).packages.length, 0);
});

test('reports source, coverage and multi-coverage classification conflicts', () => {
  const canonical = mapLegacyCatalog(legacy);
  canonical.products[0].coverageType = 'region';
  canonical.products[1].coverageIds = ['one', 'two'];
  canonical.products[1].legacySource = 'destination';
  canonical.products[1].coverageType = 'country';
  const adapted = adaptCanonicalToLegacy(canonical);
  assert.equal(adapted.destinations.length, 0);
  assert.equal(adapted.packages.length, 0);
  assert.equal(adapted.diagnostics.classificationConflicts.length, 2);
});

test('does not project a top-up variant into a legacy product', () => {
  const canonical = mapLegacyCatalog(legacy);
  canonical.variants[0].fulfillmentMethod = 'WORLDMOVE_TOPUP';
  const adapted = adaptCanonicalToLegacy(canonical);
  assert.equal(adapted.destinations.length, 0);
  assert.equal(
    adapted.diagnostics.unsupportedLegacyProjection.some(
      (item) => item.variantId === 'variant-1',
    ),
    true,
  );
});

test('does not expose canonical-native draft or archived products to legacy GET', () => {
  const draft = {
    id: 'canonical-draft',
    status: 'draft',
  };
  const archived = {
    id: 'canonical-archived',
    status: 'archived',
  };
  const result = adaptCanonicalToLegacy({
    products: [draft, archived],
    variants: [],
  });
  assert.deepEqual(result.destinations, []);
  assert.deepEqual(result.packages, []);
  assert.deepEqual(result.diagnostics.unsupportedLegacyProjection, []);
  assert.deepEqual(result.diagnostics.classificationConflicts, []);
});
