import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createReconciliationRepository } from './reconciliationRepository.js';

const baseRecord = {
  productId: 'japan',
  variantId: 'variant-1',
  sku: 'JP-10GB',
  wmproductId: 'WM-JP-10GB',
  providerOfferId: 'worldmove:WM-JP-10GB',
  status: 'MATCHED',
  suggestedResolution: 'WORLDMOVE_ESIM_REDEEM',
  reason: 'Exact match.',
  providerSnapshotHash: 'hash-1',
  createdAt: '2026-07-28T12:00:00.000Z',
  updatedAt: '2026-07-28T12:00:00.000Z',
};

const withRepository = async (callback) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-reconciliation-'));
  const recordsFile = path.join(directory, 'catalog_reconciliation.json');
  const repository = createReconciliationRepository({ recordsFile });

  try {
    await callback({ directory, recordsFile, repository });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test('missing reconciliation file returns an empty array', async () => {
  await withRepository(async ({ repository }) => {
    assert.deepEqual(await repository.listRecords(), []);
  });
});

test('empty JSON array reads normally', async () => {
  await withRepository(async ({ recordsFile, repository }) => {
    await writeFile(recordsFile, '[]\n', 'utf8');
    assert.deepEqual(await repository.listRecords(), []);
  });
});

test('writes validated records atomically without leaving temp files', async () => {
  await withRepository(async ({ directory, recordsFile, repository }) => {
    await repository.saveRecords([baseRecord]);
    assert.deepEqual(
      JSON.parse(await readFile(recordsFile, 'utf8')),
      [baseRecord],
    );
    assert.deepEqual(
      (await readdir(directory)).filter((name) => name.endsWith('.tmp')),
      [],
    );
  });
});

test('rejects an invalid reconciliation record', async () => {
  await withRepository(async ({ repository }) => {
    await assert.rejects(
      repository.saveRecords([{ ...baseRecord, status: 'INVALID' }]),
      /invalid status/,
    );
  });
});

test('parse failure does not overwrite the broken file', async () => {
  await withRepository(async ({ recordsFile, repository }) => {
    const broken = '{"broken":';
    await writeFile(recordsFile, broken, 'utf8');
    await assert.rejects(repository.listRecords());
    assert.equal(await readFile(recordsFile, 'utf8'), broken);
  });
});

test('rejects duplicate variantId records', async () => {
  await withRepository(async ({ repository }) => {
    await assert.rejects(
      repository.saveRecords([
        baseRecord,
        { ...baseRecord, productId: 'thailand' },
      ]),
      /Duplicate reconciliation variantId/,
    );
  });
});
