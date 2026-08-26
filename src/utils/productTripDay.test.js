import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveVariantForTripDay } from './productTripDay.js';

const variants = [
  { id: 'esim-5gb', medium: 'esim', dataLimit: '5 GB', dataPolicy: 'daily', tripDayOptions: [2, 3] },
  { id: 'esim-10gb', medium: 'esim', dataLimit: '10 GB', dataPolicy: 'daily', tripDayOptions: [3, 4] },
  { id: 'physical', medium: 'physical_sim', dataLimit: '10 GB', tripDayOptions: [4] },
];

test('resolves a trip day within the selected eSIM data tier', () => {
  const result = resolveVariantForTripDay({
    variants,
    day: 3,
    selectedVariant: variants[1],
  });
  assert.equal(result?.id, 'esim-10gb');
});

test('does not switch to another data tier or physical variant for a trip day', () => {
  const result = resolveVariantForTripDay({
    variants,
    day: 4,
    selectedVariant: variants[0],
  });
  assert.equal(result, null);
});
