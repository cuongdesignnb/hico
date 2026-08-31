import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryFulfillmentBindingRepository } from './fulfillmentBindingRepository.js';

const input = (overrides = {}) => ({
  variantId: 'variant-3',
  provider: 'WORLDMOVE',
  strategy: 'MAPPED_FALLBACK',
  providerOfferId: 'offer-5',
  familyKey: 'worldmove-cn-500mb',
  requestedDays: 3,
  providerDays: 5,
  upgradeDays: 2,
  ...overrides,
});

test('binding repository versions remaps, preserves revoked history, and blocks conflicts', async () => {
  const repository = createInMemoryFulfillmentBindingRepository({ idFactory: () => 'binding-1' });
  const created = await repository.create(input(), { id: 'admin-1' });
  assert.equal(created.version, 1);
  assert.equal((await repository.findActiveByVariant('variant-3')).id, 'binding-1');
  assert.equal((await repository.create(input())).id, 'binding-1');
  await assert.rejects(repository.create(input({ providerOfferId: 'offer-6' })), (error) => error.code === 'FULFILLMENT_BINDING_CONFLICT');

  const remapped = await repository.update('binding-1', input({ providerOfferId: 'offer-6', providerDays: 6, upgradeDays: 3 }), { id: 'admin-2' }, 1);
  assert.equal(remapped.version, 2);
  await assert.rejects(repository.update('binding-1', input(), {}, 1), (error) => error.code === 'VERSION_CONFLICT');

  const revoked = await repository.revoke('binding-1', { id: 'admin-2' }, 2);
  assert.equal(revoked.status, 'REVOKED');
  assert.equal(await repository.findActiveByVariant('variant-3'), null);
  assert.equal((await repository.list()).length, 1);
  assert.equal((await repository.listEvents('binding-1')).map((event) => event.eventType).join(','), 'CREATE,REMAP,REVOKE');
});

test('binding repository rejects a shorter provider duration and invalid upgrade', async () => {
  const repository = createInMemoryFulfillmentBindingRepository();
  await assert.rejects(repository.create(input({ providerDays: 2, upgradeDays: -1 })), (error) => error.code === 'FULFILLMENT_BINDING_INVALID');
});
