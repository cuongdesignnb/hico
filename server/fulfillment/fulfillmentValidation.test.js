import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFulfillmentSupported } from './fulfillmentValidation.js';

const worldmoveEsim = (overrides = {}) => ({
  fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM',
  medium: 'esim',
  supplier: 'worldmove',
  providerProductType: 0,
  leSIM: true,
  wmproductId: 'WM-e-CN-500MB-1D',
  ...overrides,
});

test('active Worldmove eSIM contract requires exact provider identity fields', () => {
  assert.equal(assertFulfillmentSupported(worldmoveEsim()), 'WORLDMOVE_ESIM_REDEEM');
  assert.throws(() => assertFulfillmentSupported(worldmoveEsim({ wmproductId: '' })), (error) => error.code === 'FULFILLMENT_INVALID');
  assert.throws(() => assertFulfillmentSupported(worldmoveEsim({ leSIM: false })), (error) => error.code === 'FULFILLMENT_INVALID');
});

test('active HICO manual QR and physical stock contracts stay provider-free', () => {
  assert.equal(assertFulfillmentSupported({
    fulfillmentMethod: 'HICO_MANUAL_QR',
    medium: 'esim',
    supplier: 'hico',
    shippingRequired: false,
  }), 'HICO_MANUAL_QR');
  assert.equal(assertFulfillmentSupported({
    fulfillmentMethod: 'HICO_PHYSICAL_STOCK',
    medium: 'physical_sim',
    supplier: 'hico',
    shippingRequired: true,
  }), 'HICO_PHYSICAL_STOCK');
  assert.throws(() => assertFulfillmentSupported({
    fulfillmentMethod: 'HICO_MANUAL_QR',
    medium: 'esim',
    supplier: 'hico',
    providerOfferId: 'provider-offer-must-not-be-here',
  }), (error) => error.code === 'FULFILLMENT_INVALID');
});

test('legacy Worldmove physical and top-up methods remain readable but retired for new orders', () => {
  for (const fulfillmentMethod of ['WORLDMOVE_PHYSICAL_ORDER', 'WORLDMOVE_TOPUP']) {
    assert.throws(() => assertFulfillmentSupported({ fulfillmentMethod }), (error) => error.code === 'FULFILLMENT_RETIRED' && error.status === 410);
  }
});
