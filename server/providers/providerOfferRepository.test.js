import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createProviderOfferRepository } from './providerOfferRepository.js';

const createOffer = (overrides = {}) => ({
  id: 'worldmove:WM-001',
  provider: 'worldmove',
  wmproductId: 'WM-001',
  providerProductId: 'provider-product-1',
  providerProductName: 'Japan data plan',
  providerProductLanguage: null,
  productRegion: 'Japan',
  providerProductType: 0,
  leSIM: true,
  providerCost: 90,
  providerCurrency: 'TWD',
  cEndPrice: 120,
  cEndVisible: true,
  active: true,
  syncedAt: '2026-07-28T10:00:00.000Z',
  rawHash: 'hash-1',
  ...overrides,
});

test('sync is idempotent and preserves missing offers as inactive', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'hico-provider-'));
  const offersFile = path.join(directory, 'provider_offers.json');
  const repository = createProviderOfferRepository({ offersFile });
  context.after(() => rm(directory, { recursive: true, force: true }));

  const first = await repository.replaceFromSync(
    [createOffer()],
    '2026-07-28T10:00:00.000Z',
  );
  const second = await repository.replaceFromSync(
    [createOffer({ syncedAt: '2026-07-28T11:00:00.000Z' })],
    '2026-07-28T11:00:00.000Z',
  );
  const third = await repository.replaceFromSync(
    [],
    '2026-07-28T12:00:00.000Z',
  );
  const persisted = JSON.parse(await readFile(offersFile, 'utf8'));

  assert.equal(first.created, 1);
  assert.equal(second.unchanged, 1);
  assert.equal(third.deactivated, 1);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].active, false);
});
