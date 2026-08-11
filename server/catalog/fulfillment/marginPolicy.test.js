import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateMargin, MARGIN_STATUSES } from './marginPolicy.js';

test('margin policy never applies implicit FX', () => {
  assert.equal(evaluateMargin({ soldPrice: 100000, soldCurrency: 'VND', providerCost: 90, providerCurrency: 'TWD' }).status, MARGIN_STATUSES.UNKNOWN_CURRENCY);
  assert.equal(evaluateMargin({ soldPrice: 100, soldCurrency: 'VND', providerCost: 60, providerCurrency: 'VND', minMarginPercent: 30 }).status, MARGIN_STATUSES.OK);
  assert.equal(evaluateMargin({ soldPrice: 100, soldCurrency: 'VND', providerCost: 60, providerCurrency: 'VND', minMarginPercent: 50.1 }).status, MARGIN_STATUSES.BELOW_POLICY);
});
