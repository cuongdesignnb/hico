import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyHicoPackageClass, operationEvidenceFor, sourceOperationFor } from './hicoGocSourceClassifier.js';

test('package class is exact and does not infer from nearby labels', () => {
  assert.equal(classifyHicoPackageClass('Sim & eSIM'), 'STANDARD_TRAVEL');
  assert.equal(classifyHicoPackageClass('Sẵn gói'), 'PRELOADED');
  assert.equal(classifyHicoPackageClass('sim VN'), 'DOMESTIC_VN');
  assert.equal(classifyHicoPackageClass('eSIM+ gọi'), 'VOICE');
  assert.equal(classifyHicoPackageClass('SIM quốc tế'), 'UNKNOWN');
});

test('HICO source contract derives operation from package class plus WMID medium', () => {
  const cases = [
    ['Sim & eSIM', 'physical_sim', 'topup'],
    ['Sim & eSIM', 'esim', 'new_subscription'],
    ['Sim', 'physical_sim', 'topup'],
    ['eSim', 'physical_sim', 'topup'],
    ['eSim', 'esim', 'new_subscription'],
    ['Sim', 'esim', 'new_subscription'],
    ['Sẵn gói', 'physical_sim', 'new_subscription'],
    ['Sẵn gói', 'esim', 'new_subscription'],
    ['sim VN', 'physical_sim', 'new_subscription'],
    ['sim VN', 'esim', 'new_subscription'],
    ['eSIM+ gọi', 'physical_sim', 'new_subscription'],
    ['eSIM+ gọi', 'esim', 'new_subscription'],
    ['Sim/eSim + gọi', 'physical_sim', 'new_subscription'],
    ['Sim/eSim + gọi', 'esim', 'new_subscription'],
  ];
  for (const [sourceCategoryLabel, sourceMedium, operation] of cases) {
    const result = sourceOperationFor({ sourceCategoryLabel, sourceMedium });
    assert.equal(result.operation, operation, `${sourceCategoryLabel}/${sourceMedium}`);
    assert.equal(result.resolution, 'RESOLVED');
  }
});

test('unknown physical stays unresolved while unknown eSIM uses the safe new-subscription fallback', () => {
  assert.equal(sourceOperationFor({ sourceCategoryLabel: 'Không rõ', sourceMedium: 'physical_sim' }).resolution, 'UNRESOLVED');
  assert.deepEqual(sourceOperationFor({ sourceCategoryLabel: 'Không rõ', sourceMedium: 'esim' }), {
    operation: 'new_subscription', resolution: 'RESOLVED', evidence: 'UNKNOWN_ESIM_FALLBACK', expectedProviderProductType: 0,
  });
});

test('provider product type wins but a contradiction remains unresolved for review', () => {
  const matching = operationEvidenceFor({ sourceCategoryLabel: 'Sim & eSIM', sourceMedium: 'physical_sim', providerOffer: { providerProductType: 2 } });
  assert.equal(matching.operation, 'topup');
  assert.equal(matching.resolution, 'RESOLVED');
  const conflicting = operationEvidenceFor({ sourceCategoryLabel: 'Sim & eSIM', sourceMedium: 'physical_sim', providerOffer: { providerProductType: 1 } });
  assert.equal(conflicting.operation, 'new_subscription');
  assert.equal(conflicting.resolution, 'UNRESOLVED');
  assert.equal(conflicting.providerSourceConflict, true);
});
