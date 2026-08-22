import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyHicoPackageClass, operationEvidenceFor } from './hicoGocSourceClassifier.js';

test('package class is exact and does not infer from nearby labels', () => {
  assert.equal(classifyHicoPackageClass('Sim & eSIM'), 'STANDARD_TRAVEL');
  assert.equal(classifyHicoPackageClass('Sẵn gói'), 'PRELOADED');
  assert.equal(classifyHicoPackageClass('sim VN'), 'DOMESTIC_VN');
  assert.equal(classifyHicoPackageClass('eSIM+ gọi'), 'VOICE');
  assert.equal(classifyHicoPackageClass('SIM quốc tế'), 'UNKNOWN');
});

test('source label Sim & eSIM does not infer top-up', () => {
  const result = operationEvidenceFor({ sourceCategoryLabel: 'Sim & eSIM' });
  assert.equal(result.operation, 'new_subscription');
  assert.equal(result.resolution, 'UNRESOLVED');
});

test('only explicit top-up evidence resolves top-up', () => {
  assert.equal(operationEvidenceFor({ sourceCategoryLabel: 'Nạp thêm' }).operation, 'topup');
  assert.equal(operationEvidenceFor({ providerOffer: { providerProductType: 2 } }).operation, 'topup');
});
