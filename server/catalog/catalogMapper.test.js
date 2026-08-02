import assert from 'node:assert/strict';
import test from 'node:test';
import { mapLegacyCatalog, mapLegacyVariant } from './catalogMapper.js';

const baseVariant = {
  id: 'variant-1',
  sku: 'SKU-1',
  dataLimit: '5 GB',
  duration: '7 Ngày',
  price: 250000,
  compareAtPrice: 300000,
  wmproductId: 'WM-1',
};

test('maps legacy products without changing product or variant identifiers', () => {
  const result = mapLegacyCatalog({
    destinations: [{
      id: 'jp-esim',
      name: 'Nhật Bản',
      featured: true,
      variants: [{ ...baseVariant, simType: 'leSIM' }],
    }],
    packages: [{
      id: 'asia-esim',
      name: 'Châu Á',
      iconType: 'region',
      variants: [{ ...baseVariant, id: 'variant-2', sku: 'SKU-2', simType: 'manual' }],
    }],
  });

  assert.deepEqual(result.products.map((product) => product.id), ['jp-esim', 'asia-esim']);
  assert.deepEqual(result.variants.map((variant) => variant.id), ['variant-1', 'variant-2']);
  assert.equal(result.products[0].coverageType, 'country');
  assert.equal(result.products[1].coverageType, 'region');
  assert.equal(result.variants[0].wmproductId, 'WM-1');
});

test('maps known legacy SIM types to their required fulfillment methods', () => {
  const leSim = mapLegacyVariant({ ...baseVariant, simType: 'leSIM' }, 'product-1', 'destination');
  const manual = mapLegacyVariant({ ...baseVariant, simType: 'manual' }, 'product-1', 'destination');
  const physical = mapLegacyVariant({ ...baseVariant, simType: 'physical' }, 'product-1', 'destination');

  assert.equal(leSim.fulfillmentMethod, 'WORLDMOVE_ESIM_REDEEM');
  assert.equal(leSim.supplier, 'worldmove');
  assert.equal(manual.fulfillmentMethod, 'HICO_MANUAL_QR');
  assert.equal(physical.fulfillmentMethod, 'HICO_PHYSICAL_STOCK');
  assert.equal(physical.medium, 'physical_sim');
});

test('marks ambiguous legacy eSIM variants for review', () => {
  const variant = mapLegacyVariant(
    { ...baseVariant, simType: 'eSIM', leSIM: false },
    'product-1',
    'package',
  );

  assert.equal(variant.fulfillmentMethod, 'MANUAL_PROCESSING');
  assert.equal(variant.needsReview, true);
  assert.equal(variant.medium, 'esim');
  assert.equal(variant.id, baseVariant.id);
  assert.equal(variant.sku, baseVariant.sku);
});
