import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryFulfillmentProfileRepository } from './fulfillmentProfileRepository.js';
import { createFulfillmentProfileService } from './fulfillmentProfileService.js';

const variant = { id: 'var-1032', sku: 'Esim0481', duration: '1 Ngày', active: true };
const input = { variantId: 'var-1032', provider: 'WORLDMOVE', regionCode: 'Mainland China', medium: 'eSIM', dataPolicy: '500MB / Ngày', speedPolicy: '128kbps after quota', networkPolicy: 'China Unicom/Telecom', operationType: 'DATA_ONLY', durationDays: 1, source: 'ADMIN_APPROVED_BACKFILL' };

test('profile service requires confirmation and computes the structured family key', async () => {
  const profileRepository = createInMemoryFulfillmentProfileRepository({ idFactory: () => 'profile-1' });
  const service = createFulfillmentProfileService({
    catalogReader: { readCatalog: async () => ({ products: [{ id: 'product-1' }], variants: [{ ...variant, productId: 'product-1' }] }) },
    profileRepository,
  });
  await assert.rejects(service.approve({ input, confirmed: false }), (error) => error.code === 'ADMIN_CONFIRMATION_REQUIRED');
  const profile = await service.approve({ input, confirmed: true, actor: { id: 'admin-1' } });
  assert.equal(profile.variantId, 'var-1032');
  assert.match(profile.familyKey, /provider=WORLDMOVE/);
  assert.doesNotMatch(profile.familyKey, /duration|price|wmproduct/i);
  assert.equal((await service.list()).total, 1);
});
