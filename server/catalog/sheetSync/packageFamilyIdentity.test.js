import assert from 'node:assert/strict';
import test from 'node:test';
import { packageFamilyKeyFor, productSourceKeyFor, variantSourceKeyFor } from './packageFamilyIdentity.js';

test('package family ignores medium and coverage while Product identity separates medium', () => {
  const base = { productName: 'Trung Quốc 500MB/ngày', dataPolicy: 'daily', coverageLabel: 'China' };
  assert.equal(packageFamilyKeyFor({ ...base, medium: 'physical_sim' }), packageFamilyKeyFor({ ...base, medium: 'esim', coverageLabel: 'Hong Kong' }));
  assert.notEqual(productSourceKeyFor({ ...base, operation: 'new_subscription', medium: 'physical_sim' }), productSourceKeyFor({ ...base, operation: 'new_subscription', medium: 'esim' }));
  assert.notEqual(variantSourceKeyFor({ ...base, operation: 'new_subscription', medium: 'esim', sku: 'SKU', wmproductId: 'WM', durationDays: 1 }), variantSourceKeyFor({ ...base, operation: 'new_subscription', medium: 'esim', sku: 'SKU', wmproductId: 'WM', durationDays: 3 }));
});
