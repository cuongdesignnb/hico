import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryVariantAliasRepository } from './variantAliasRepository.js';
import { resolveSheetVariantIdentity } from './variantIdentityResolver.js';

const product = { id: 'product-1', slug: 'vietnam', status: 'active', name: 'Vietnam' };
const variant = { id: 'variant-1', productId: product.id, sku: 'Esim0481', medium: 'esim', price: 100000, currency: 'VND' };
const row = (sku = 'Esim0481') => ({ normalizedData: { sku, medium: 'esim' } });

test('alias repository normalizes keys and prevents duplicate active mappings', async () => {
  const repository = createInMemoryVariantAliasRepository({ idFactory: (() => { let i = 0; return () => `alias-${++i}`; })() });
  const created = await repository.create({ namespace: 'SIM_HICO_SKU_ESIM', externalKey: ' esim0481 ', medium: 'esim', variantId: variant.id }, { id: 'admin-1' });
  assert.equal(created.normalizedExternalKey, 'ESIM0481');
  assert.equal((await repository.create({ namespace: 'SIM_HICO_SKU_ESIM', externalKey: 'ESIM0481', medium: 'esim', variantId: variant.id })).id, created.id);
  await assert.rejects(repository.create({ namespace: 'SIM_HICO_SKU_ESIM', externalKey: 'ESIM0481', medium: 'esim', variantId: 'variant-2' }), (error) => error.code === 'EXTERNAL_ALIAS_DUPLICATE');
  const revoked = await repository.revoke(created.id, { id: 'admin-1' }, created.version);
  assert.equal(revoked.status, 'REVOKED');
  assert.equal(await repository.findActive({ namespace: 'SIM_HICO_SKU_ESIM', externalKey: 'ESIM0481', medium: 'esim' }), null);
  await assert.rejects(repository.create({ namespace: 'SIM_HICO_SKU_ESIM', externalKey: 'ESIM0481', medium: 'esim', variantId: variant.id }), (error) => error.code === 'EXTERNAL_ALIAS_DUPLICATE');
});

test('resolver prefers canonical identity and blocks direct versus alias conflicts', () => {
  const alias = { id: 'alias-1', namespace: 'SIM_HICO_SKU_ESIM', normalizedExternalKey: 'ESIM0481', medium: 'esim', variantId: 'variant-2', status: 'ACTIVE' };
  assert.equal(resolveSheetVariantIdentity({ row: row(), products: [product], variants: [variant], aliases: [] }).identityMatch, 'MATCHED_CANONICAL');
  assert.equal(resolveSheetVariantIdentity({ row: row(), products: [product], variants: [variant, { ...variant, id: 'variant-2', sku: 'OTHER' }], aliases: [alias] }).error.code, 'IDENTITY_CONFLICT');
});

test('resolver uses an active alias only when direct SKU matching is absent', () => {
  const alias = { id: 'alias-1', namespace: 'SIM_HICO_SKU_ESIM', normalizedExternalKey: 'ESIM0482', medium: 'esim', variantId: 'variant-2', status: 'ACTIVE' };
  const result = resolveSheetVariantIdentity({ row: row('Esim0482'), products: [product], variants: [variant, { ...variant, id: 'variant-2', sku: 'CANONICAL-2' }], aliases: [alias] });
  assert.equal(result.identityMatch, 'MATCHED_ALIAS');
  assert.equal(result.variant.id, 'variant-2');
});
