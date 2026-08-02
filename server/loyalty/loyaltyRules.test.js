import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateEarnPoints, isEligibleItem, parseVndMinorUnits, publicRule, requiredMilestoneFor } from './loyaltyRules.js';

test('loyalty calculation uses integer VND minor units and floors points', () => {
  assert.equal(parseVndMinorUnits('10000.50'), 1000050n);
  assert.equal(calculateEarnPoints({ unitPrice: '99999.99', quantity: 1 }), 9);
  assert.equal(calculateEarnPoints({ unitPrice: '5000', quantity: 1 }), 0);
  assert.equal(calculateEarnPoints({ unitPrice: '10000', quantity: 2, currency: 'usd' }), 0);
});

test('loyalty eligibility and milestones follow frozen v1 contract', () => {
  assert.deepEqual(isEligibleItem({ operation: 'topup', unitPrice: 100000, quantity: 1 }, 'VND'), { eligible: true, currency: 'VND', points: 10 });
  assert.equal(requiredMilestoneFor({ operation: 'esim' }), 'PROVISIONED');
  assert.equal(requiredMilestoneFor({ operation: 'device_sale' }), 'SHIPPED');
  assert.equal(isEligibleItem({ operation: 'topup', unitPrice: 100000, quantity: 1 }, 'USD').eligible, false);
  assert.equal(isEligibleItem({ operation: 'topup', unitPrice: 100000, quantity: 1, loyaltyExcluded: true }, 'VND').eligible, false);
});

test('public loyalty rule never includes internal config', () => {
  const rule = publicRule({ rule_id: 'catalog_fulfillment', version: 'v1', config_jsonb: { secret: 'hidden' } });
  assert.equal(rule.id, 'catalog_fulfillment');
  assert.equal('config_jsonb' in rule, false);
  assert.equal(rule.redemption, 'unavailable');
});
