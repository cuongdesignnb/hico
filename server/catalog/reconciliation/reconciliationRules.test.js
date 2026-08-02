import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileCatalogVariant } from './reconciliationRules.js';

const NOW = '2026-07-28T12:00:00.000Z';

const baseProduct = {
  id: 'japan',
  operation: 'new_subscription',
};

const baseVariant = {
  id: 'variant-1',
  productId: 'japan',
  sku: 'JP-10GB',
  wmproductId: 'WM-JP-10GB',
  medium: 'esim',
  fulfillmentMethod: 'MANUAL_PROCESSING',
};

const baseOffer = {
  id: 'worldmove:WM-JP-10GB',
  wmproductId: 'WM-JP-10GB',
  providerProductType: 0,
  leSIM: true,
  active: true,
  rawHash: 'hash-1',
};

const reconcile = ({
  product = baseProduct,
  variant = baseVariant,
  offers = [baseOffer],
} = {}) => reconcileCatalogVariant({
  product,
  variant,
  matchingOffers: offers,
  now: NOW,
});

test('maps Worldmove leSIM to automatic redeem', () => {
  const record = reconcile();
  assert.equal(record.status, 'MATCHED');
  assert.equal(record.suggestedResolution, 'WORLDMOVE_ESIM_REDEEM');
});

test('maps local-carrier eSIM to order then redeem', () => {
  const record = reconcile({
    offers: [{ ...baseOffer, leSIM: false }],
  });
  assert.equal(record.status, 'MATCHED');
  assert.equal(
    record.suggestedResolution,
    'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  );
});

test('maps physical Worldmove SIM', () => {
  const record = reconcile({
    variant: {
      ...baseVariant,
      medium: 'physical_sim',
      fulfillmentMethod: 'HICO_PHYSICAL_STOCK',
    },
    offers: [{
      ...baseOffer,
      providerProductType: 1,
      leSIM: null,
    }],
  });
  assert.equal(record.status, 'MATCHED');
  assert.equal(record.suggestedResolution, 'WORLDMOVE_PHYSICAL_ORDER');
});

test('maps Worldmove top-up', () => {
  const record = reconcile({
    product: { ...baseProduct, operation: 'topup' },
    offers: [{
      ...baseOffer,
      providerProductType: 2,
      leSIM: null,
    }],
  });
  assert.equal(record.status, 'MATCHED');
  assert.equal(record.suggestedResolution, 'WORLDMOVE_TOPUP');
});

test('requires review when wmproductId is missing', () => {
  const { wmproductId: _wmproductId, ...variant } = baseVariant;
  assert.equal(
    reconcile({ variant, offers: [] }).status,
    'MISSING_WMPRODUCT_ID',
  );
});

test('marks exact wmproductId not found', () => {
  assert.equal(reconcile({ offers: [] }).status, 'NOT_FOUND');
});

test('does not select the first duplicate provider offer', () => {
  const record = reconcile({
    offers: [baseOffer, { ...baseOffer, id: 'worldmove:duplicate' }],
  });
  assert.equal(record.status, 'DUPLICATE_PROVIDER_OFFER');
  assert.equal(record.providerOfferId, undefined);
});

test('marks inactive provider offer', () => {
  assert.equal(
    reconcile({ offers: [{ ...baseOffer, active: false }] }).status,
    'INACTIVE_PROVIDER_OFFER',
  );
});

test('detects manual QR legacy conflict', () => {
  const record = reconcile({
    variant: {
      ...baseVariant,
      fulfillmentMethod: 'HICO_MANUAL_QR',
    },
  });
  assert.equal(record.status, 'LEGACY_CONFLICT');
});

test('detects physical legacy variant matched to eSIM', () => {
  const record = reconcile({
    variant: {
      ...baseVariant,
      medium: 'physical_sim',
      fulfillmentMethod: 'HICO_PHYSICAL_STOCK',
    },
  });
  assert.equal(record.status, 'LEGACY_CONFLICT');
});

test('detects top-up offer on non-top-up product', () => {
  const record = reconcile({
    offers: [{
      ...baseOffer,
      providerProductType: 2,
      leSIM: null,
    }],
  });
  assert.equal(record.status, 'TYPE_CONFLICT');
});

test('detects a linked manual QR reference before switching provider', () => {
  const record = reconcile({
    variant: {
      ...baseVariant,
      manualQrReference: 'qr-123',
    },
  });
  assert.equal(record.status, 'LEGACY_CONFLICT');
});

test('requires review when provider type data is incomplete', () => {
  const record = reconcile({
    offers: [{
      ...baseOffer,
      providerProductType: 0,
      leSIM: null,
    }],
  });
  assert.equal(record.status, 'NEEDS_REVIEW');
});
