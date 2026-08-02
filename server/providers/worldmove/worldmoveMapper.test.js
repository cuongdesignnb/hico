import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mapWorldmoveOffer,
  mapWorldmoveQuotation,
} from './worldmoveMapper.js';

const syncedAt = '2026-07-28T10:00:00.000Z';
const baseOffer = {
  wmproductId: 'WM-001',
  productId: 'provider-product-1',
  productName: 'Japan data plan',
  productNamelang: null,
  productRegion: 'Japan',
  productType: 0,
  productPrice: 90,
  productcPrice: 120,
  csight: 1,
  leSIM: true,
};

test('maps Worldmove leSIM quotation', () => {
  const offer = mapWorldmoveOffer(baseOffer, syncedAt);

  assert.equal(offer.providerProductType, 0);
  assert.equal(offer.leSIM, true);
  assert.equal(offer.providerCost, 90);
  assert.equal(offer.providerCurrency, 'TWD');
});

test('maps Worldmove local-carrier eSIM quotation', () => {
  const offer = mapWorldmoveOffer(
    { ...baseOffer, leSIM: false },
    syncedAt,
  );

  assert.equal(offer.providerProductType, 0);
  assert.equal(offer.leSIM, false);
});

test('maps Worldmove physical SIM quotation', () => {
  const offer = mapWorldmoveOffer(
    { ...baseOffer, productType: 1, leSIM: false },
    syncedAt,
  );

  assert.equal(offer.providerProductType, 1);
});

test('maps Worldmove top-up quotation', () => {
  const offer = mapWorldmoveOffer(
    { ...baseOffer, productType: 2, leSIM: false },
    syncedAt,
  );

  assert.equal(offer.providerProductType, 2);
});

test('rejects a quotation with missing required fields', () => {
  assert.throws(
    () => mapWorldmoveOffer(
      { ...baseOffer, wmproductId: '' },
      syncedAt,
    ),
    /wmproductId/,
  );
});

test('rejects an invalid quotation response', () => {
  assert.throws(
    () => mapWorldmoveQuotation(
      { code: 0, msg: 'Success' },
      syncedAt,
    ),
    /prodList/,
  );
});
