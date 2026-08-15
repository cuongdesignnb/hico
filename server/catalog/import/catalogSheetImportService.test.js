import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cloneSeedCategories } from '../categories/catalogCategories.js';
import { createCatalogCommandService } from '../write/catalogCommandService.js';
import { createCatalogIdempotencyRepository } from '../write/catalogIdempotencyRepository.js';
import { createCatalogSheetImportService } from './catalogSheetImportService.js';

const text = (wmid = 'WM-e-CN-500MB-1D') => `Family\tWMID\tData\tDuration\tPrice\tCoverage\nChina daily\t${wmid}\t500MB/day\t1 day\t70000\tcn`;
const columnMap = { family: 'Family', sku: 'WMID', dataLimit: 'Data', duration: 'Duration', price: 'Price', coverageId: 'Coverage' };
const offer = { id: 'offer-1', wmproductId: 'WM-e-CN-500MB-1D', providerProductId: 'provider-1', providerProductType: 0, leSIM: true, active: true };

const setup = async (t, initialOffers = [offer]) => {
  const uploadsDirectory = await mkdtemp(path.join(os.tmpdir(), 'hico-catalog-import-'));
  t.after(() => rm(uploadsDirectory, { recursive: true, force: true }));
  const context = { manifest: { versionId: 'catalog-v1' }, products: [], variants: [], categories: cloneSeedCategories() };
  let providerOffers = initialOffers;
  const commits = [];
  const service = createCatalogSheetImportService({
    uploadsDirectory,
    catalogRepository: { readCatalog: async () => context },
    providerRepository: { listOffers: async () => providerOffers },
    commandService: createCatalogCommandService({
      env: { CATALOG_READ_SOURCE: 'canonical' },
      idempotencyRepository: createCatalogIdempotencyRepository({ recordsFile: path.join(uploadsDirectory, 'catalog_import_idempotency.json') }),
    }),
    commitService: { commit: async (payload) => { commits.push(payload); return { manifest: { versionId: payload.versionId }, warnings: [] }; } },
    auditRepository: { append: async () => undefined, remove: async () => undefined },
    now: () => new Date('2026-08-15T00:00:00.000Z'),
  });
  return { service, commits, setProviderOffers: (next) => { providerOffers = next; } };
};

test('provider import exact-matches WMID and never falls back to a similar identifier', async (t) => {
  const { service } = await setup(t);
  const exact = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich', sourceMode: 'worldmove', text: text(), columnMap });
  assert.equal(exact.blocked, 0);
  const fuzzy = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich', sourceMode: 'worldmove', text: text('wm-e-cn-500mb-1d'), columnMap });
  assert.equal(fuzzy.blocked, 1);
  assert.deepEqual(fuzzy.errors[0].errors, ['PROVIDER_NOT_FOUND']);
});

test('execute commits all imported families as draft/inactive with public aliases', async (t) => {
  const { service, commits } = await setup(t);
  const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich', sourceMode: 'worldmove', text: text(), columnMap });
  const request = { previewId: preview.previewId, catalogVersionId: preview.catalogVersionId, confirm: true, idempotencyKey: 'import-1' };
  const result = await service.execute(request, { id: 'admin-1' });
  const replay = await service.execute(request, { id: 'admin-1' });
  assert.equal(result.status, 201);
  assert.equal(replay.replayed, true);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].products[0].status, 'draft');
  assert.equal(commits[0].products[0].categoryId, 'cat-esim-du-lich');
  assert.equal(commits[0].variants[0].active, false);
  assert.match(commits[0].variants[0].publicSku, /^HICO-[A-F0-9]{8}$/);
  assert.equal(commits[0].variants[0].wmproductId, offer.wmproductId);
});

test('blocked preview cannot partially commit', async (t) => {
  const { service, commits } = await setup(t);
  const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich', sourceMode: 'worldmove', text: text('UNKNOWN'), columnMap });
  await assert.rejects(
    service.execute({ previewId: preview.previewId, catalogVersionId: preview.catalogVersionId, confirm: true, idempotencyKey: 'import-blocked' }),
    (error) => error.code === 'IMPORT_BLOCKED',
  );
  assert.equal(commits.length, 0);
});

test('preview groups multiple families and execute rejects provider snapshot drift', async (t) => {
  const secondOffer = { ...offer, id: 'offer-2', wmproductId: 'WM-e-CN-1GB-1D', providerProductId: 'provider-2' };
  const { service, commits, setProviderOffers } = await setup(t, [offer, secondOffer]);
  const pasted = `${text()}\nChina 1GB\t${secondOffer.wmproductId}\t1GB/day\t1 day\t90000\tcn`;
  const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich', sourceMode: 'worldmove', text: pasted, columnMap });
  assert.equal(preview.familyCount, 2);
  assert.equal(preview.rowCount, 2);
  setProviderOffers([offer]);
  await assert.rejects(
    service.execute({ previewId: preview.previewId, catalogVersionId: preview.catalogVersionId, confirm: true, idempotencyKey: 'import-stale' }),
    (error) => error.code === 'IMPORT_PREVIEW_STALE',
  );
  assert.equal(commits.length, 0);
});
