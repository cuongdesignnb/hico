import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySkuConflictMetadata,
  legacyDuplicateGroupId,
} from './canonicalSkuConflicts.js';

test('legacy duplicate SKU values are preserved and receive a stable group', () => {
  const variants = [
    { id: 'variant-1', sku: 'DUPLICATE-SKU' },
    { id: 'variant-2', sku: 'DUPLICATE-SKU' },
    { id: 'variant-3', sku: 'UNIQUE-SKU' },
  ];
  const marked = applySkuConflictMetadata(variants);
  assert.deepEqual(marked.map((item) => item.sku), [
    'DUPLICATE-SKU',
    'DUPLICATE-SKU',
    'UNIQUE-SKU',
  ]);
  assert.equal(marked[0].skuConflict, true);
  assert.equal(marked[1].skuConflict, true);
  assert.equal(
    marked[0].legacyDuplicateGroupId,
    legacyDuplicateGroupId('DUPLICATE-SKU'),
  );
  assert.equal(
    marked[0].legacyDuplicateGroupId,
    marked[1].legacyDuplicateGroupId,
  );
  assert.equal(marked[2].skuConflict, undefined);
});

test('conflict metadata is removed after a duplicate group is resolved', () => {
  const marked = applySkuConflictMetadata([
    {
      id: 'variant-1',
      sku: 'RESOLVED-SKU',
      skuConflict: true,
      legacyDuplicateGroupId: 'legacy-sku-old',
    },
  ]);
  assert.deepEqual(marked, [{ id: 'variant-1', sku: 'RESOLVED-SKU' }]);
});

test('same SKU with different WMIDs is not a legacy SKU conflict', () => {
  const marked = applySkuConflictMetadata([
    { id: 'variant-1', sku: 'SHARED-SKU', wmproductId: 'WM-A' },
    { id: 'variant-2', sku: 'SHARED-SKU', wmproductId: 'WM-B' },
  ]);
  assert.equal(marked[0].skuConflict, undefined);
  assert.equal(marked[1].skuConflict, undefined);
});

