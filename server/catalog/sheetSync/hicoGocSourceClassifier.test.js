import assert from 'node:assert/strict';
import test from 'node:test';
import { operationEvidenceFor } from './hicoGocSourceClassifier.js';

test('source label Sim & eSIM does not infer top-up', () => {
  const result = operationEvidenceFor({ sourceCategoryLabel: 'Sim & eSIM' });
  assert.equal(result.operation, 'new_subscription');
  assert.equal(result.resolution, 'UNRESOLVED');
});

test('only explicit top-up evidence resolves top-up', () => {
  assert.equal(operationEvidenceFor({ sourceCategoryLabel: 'Nạp thêm' }).operation, 'topup');
  assert.equal(operationEvidenceFor({ providerOffer: { providerProductType: 2 } }).operation, 'topup');
});
