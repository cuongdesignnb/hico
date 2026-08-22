import assert from 'node:assert/strict';
import test from 'node:test';
import {
  backfillProductCategories,
  categoryIdForPackage,
  categoryFilterIds,
  cloneSeedCategories,
  mergeCatalogCategories,
  inferCategoryId,
  operationForCategoryKind,
  validateCategories,
} from './catalogCategories.js';

const variants = [
  { id: 'v-esim', productId: 'p-esim', medium: 'esim' },
  { id: 'v-physical', productId: 'p-physical', medium: 'physical_sim' },
  { id: 'v-mixed-1', productId: 'p-mixed', medium: 'esim' },
  { id: 'v-mixed-2', productId: 'p-mixed', medium: 'physical_sim' },
];

test('seed category tree is valid, limited to two levels and maps kind to operation', () => {
  const categories = cloneSeedCategories();
  assert.deepEqual(validateCategories(categories), { valid: true, errors: [] });
  assert.equal(operationForCategoryKind('esim'), 'new_subscription');
  assert.equal(operationForCategoryKind('physical_sim'), 'new_subscription');
  assert.equal(operationForCategoryKind('topup'), 'topup');
  assert.equal(operationForCategoryKind('device'), 'device_sale');
  assert.equal(operationForCategoryKind('accessory'), 'device_sale');
  assert.deepEqual([...categoryFilterIds(categories, 'sim-esim')], [
    'cat-esim-du-lich',
    'cat-sim-vat-ly',
    'cat-esim-san-goi',
    'cat-sim-vat-ly-san-goi',
    'cat-esim-co-goi',
    'cat-sim-vat-ly-co-goi',
    'cat-sim-viet-nam',
  ]);
});

test('package class maps to a medium leaf and top-up overrides the class', () => {
  assert.equal(categoryIdForPackage('PRELOADED', 'esim', 'new_subscription'), 'cat-esim-san-goi');
  assert.equal(categoryIdForPackage('VOICE', 'physical_sim', 'new_subscription'), 'cat-sim-vat-ly-co-goi');
  assert.equal(categoryIdForPackage('DOMESTIC_VN', 'physical_sim', 'new_subscription'), 'cat-sim-viet-nam');
  assert.equal(categoryIdForPackage('STANDARD_TRAVEL', 'esim', 'new_subscription'), 'cat-esim-du-lich');
  assert.equal(categoryIdForPackage('UNKNOWN', 'esim', 'new_subscription'), null);
  assert.equal(categoryIdForPackage('UNKNOWN', 'physical_sim', 'topup'), 'cat-nap-them');
});

test('category seed merge preserves custom categories and adds missing leaves', () => {
  const custom = [{ ...cloneSeedCategories()[0], name: 'Tên tuỳ chỉnh' }, {
    id: 'cat-custom', slug: 'custom', name: 'Tuỳ chỉnh', parentId: null, kind: null, sortOrder: 99, status: 'active', version: 1,
    createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z',
  }];
  const merged = mergeCatalogCategories(custom);
  assert.equal(merged.find((category) => category.id === 'cat-sim-esim').name, 'Tên tuỳ chỉnh');
  assert.equal(merged.some((category) => category.id === 'cat-esim-co-goi'), true);
  assert.equal(merged.some((category) => category.id === 'cat-custom'), true);
});

test('category validation rejects duplicate slugs and a third hierarchy level', () => {
  const categories = cloneSeedCategories();
  categories.push({ ...categories[1], id: 'cat-level-three', slug: 'level-three', parentId: categories[1].id });
  categories.push({ ...categories[2], id: 'cat-duplicate-slug' });
  const result = validateCategories(categories);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('two-level')));
  assert.ok(result.errors.some((message) => message.includes('duplicate slug')));
});

test('category inference uses explicit evidence and leaves mixed subscriptions unresolved', () => {
  assert.equal(inferCategoryId({ id: 'p-topup', operation: 'topup' }, variants), 'cat-nap-them');
  assert.equal(inferCategoryId({ id: 'p-esim', operation: 'new_subscription' }, variants), 'cat-esim-du-lich');
  assert.equal(inferCategoryId({ id: 'p-physical', operation: 'new_subscription' }, variants), 'cat-sim-vat-ly');
  assert.equal(inferCategoryId({ id: 'p-device', operation: 'device_sale', deviceSpecifications: { model: 'M1' } }, variants), 'cat-bo-phat-wifi');
  assert.equal(inferCategoryId({ id: 'p-mixed', operation: 'new_subscription' }, variants), null);

  const result = backfillProductCategories({
    products: [
      { id: 'p-esim', operation: 'new_subscription', version: 1 },
      { id: 'p-mixed', operation: 'new_subscription', version: 1 },
    ],
    variants,
    now: '2026-08-15T00:00:00.000Z',
  });
  assert.equal(result.products[0].categoryId, 'cat-esim-du-lich');
  assert.equal(result.products[1].categoryNeedsReview, true);
  assert.deepEqual(result.report, {
    assigned: 1,
    unresolved: 1,
    unchanged: 0,
    assignments: [{ productId: 'p-esim', categoryId: 'cat-esim-du-lich' }],
  });
});
