import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryFulfillmentProfileRepository } from './fulfillmentProfileRepository.js';

const input = (overrides = {}) => ({
  variantId: 'var-1032',
  provider: 'WORLDMOVE',
  regionCode: 'CN',
  medium: 'ESIM',
  dataPolicy: 'DAILY_QUOTA:500:MB:DAY',
  speedPolicy: 'THROTTLE_KBPS:128:AFTER_QUOTA',
  networkPolicy: 'CN_TELECOM+CN_UNICOM',
  activationPolicy: null,
  resetPolicy: null,
  operationType: 'DATA_ONLY',
  durationDays: 1,
  familyKey: 'provider=WORLDMOVE|region=CN|medium=ESIM|dataPolicy=DAILY_QUOTA:500:MB:DAY|speedPolicy=THROTTLE_KBPS:128:AFTER_QUOTA|networkPolicy=CN_TELECOM+CN_UNICOM|operationType=DATA_ONLY',
  source: 'ADMIN_APPROVED_BACKFILL',
  ...overrides,
});

test('profile repository enforces one active profile and versioned revoke', async () => {
  const repository = createInMemoryFulfillmentProfileRepository({ idFactory: () => 'profile-1', now: () => '2026-08-10T00:00:00.000Z' });
  const created = await repository.create(input(), { id: 'admin-1' });
  assert.equal(created.status, 'ACTIVE');
  assert.equal(created.version, 1);
  assert.equal(await repository.findActiveByVariant('var-1032', 'WORLDMOVE'), created);
  assert.equal(await repository.create(input(), { id: 'admin-1' }), created);
  await assert.rejects(repository.create(input({ familyKey: 'different' }), { id: 'admin-1' }), (error) => error.code === 'FAMILY_PROFILE_CONFLICT');
  const updated = await repository.update(created.id, input({ source: 'ADMIN_EDITED' }), { id: 'admin-2' }, 1);
  assert.equal(updated.version, 2);
  await assert.rejects(repository.update(created.id, input(), { id: 'admin-2' }, 1), (error) => error.code === 'VERSION_CONFLICT');
  const revoked = await repository.revoke(created.id, { id: 'admin-2' }, 2);
  assert.equal(revoked.status, 'REVOKED');
  assert.equal(await repository.findActiveByVariant('var-1032', 'WORLDMOVE'), null);
});
