import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cloneSeedCategories } from '../categories/catalogCategories.js';
import { createEsimSheetSyncService } from './esimSheetSyncService.js';

const headers = Array.from({ length: 25 }, () => '');
Object.assign(headers, {
  0: 'Loại SIM',
  1: 'BẢNG GIÁ SIM DU LỊCH - HICO.VN',
  2: 'Ngày',
  3: 'Loại data',
  5: 'Giá eSim',
  10: 'APN',
  11: 'Quốc gia/ nhà mạng',
  13: 'mốc thời gian reset',
  15: 'Được huỷ gói',
  23: 'wmid_sim',
  24: 'wmid_esim',
});

const row = Array.from({ length: 25 }, () => '');
Object.assign(row, {
  0: 'eSIM',
  1: 'Mainland China, 1 Day, 500MB /day, 128kbps',
  2: '1',
  3: 'Chia ngày',
  5: '55000',
  10: 'mobile',
  11: 'Trung Quốc : China Unicom, China Telecom',
  13: 'Reset dung lượng: 23:00 hàng ngày',
  15: 'Có thể',
  24: 'WM-e-CN-500MB-1D',
});

test('eSIM Sheet preview/apply uses SimHICO eSIM columns and only creates drafts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-'));
  let commitInput;
  try {
    const providerOffer = {
      id: 'offer-cn-1d',
      provider: 'worldmove',
      wmproductId: 'WM-e-CN-500MB-1D',
      providerProductId: 'provider-cn-1d',
      providerProductType: 0,
      leSIM: true,
      active: true,
    };
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' },
      uploadsDirectory: directory,
      referenceClient: {
        async readRows() {
          return { spreadsheetId: 'sheet-1', sheetTab: 'SimHICO', sheetRange: 'A1:AT18315', values: [headers, row] };
        },
      },
      catalogRepository: {
        async readCatalog() {
          return { manifest: { versionId: 'catalog-v1' }, products: [], variants: [], categories: cloneSeedCategories() };
        },
      },
      providerRepository: { async listOffers() { return [providerOffer]; } },
      commandService: {
        async execute({ handler }) {
          const result = await handler({ commandId: 'command-1', requestHash: 'request-hash' });
          return { ...result, replayed: false };
        },
      },
      commitService: {
        async commit(input) {
          commitInput = input;
          return { manifest: { versionId: input.versionId }, warnings: [] };
        },
      },
      auditRepository: { async append() {}, async remove() {} },
    });

    const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' }, { id: 'admin-1' });
    assert.equal(preview.source, 'HICO_ESIM_SHEET');
    assert.equal(preview.rowCount, 1);
    assert.equal(preview.eligible, 1);
    assert.equal(preview.blocked, 0);

    const applied = await service.apply({
      previewId: preview.previewId,
      catalogVersionId: 'catalog-v1',
      idempotencyKey: 'apply-1',
      confirm: true,
    }, { id: 'admin-1' });
    assert.equal(applied.body.status, 'DRAFTS_CREATED');
    assert.equal(commitInput.products[0].status, 'draft');
    assert.equal(commitInput.variants[0].active, false);
    assert.equal(commitInput.variants[0].fulfillmentMethod, 'WORLDMOVE_ESIM_REDEEM');
    assert.equal(commitInput.variants[0].wmproductId, 'WM-e-CN-500MB-1D');
    assert.equal(commitInput.variants[0].price, 55000);
    assert.equal(commitInput.variants[0].shippingRequired, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('eSIM Sheet sync blocks non-eSIM rows and never substitutes the SIM price column', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-'));
  try {
    const physicalRow = [...row];
    physicalRow[0] = 'Sim vật lý';
    physicalRow[4] = '70000';
    physicalRow[5] = '';
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' },
      uploadsDirectory: directory,
      referenceClient: { async readRows() { return { values: [headers, physicalRow] }; } },
      catalogRepository: { async readCatalog() { return { manifest: { versionId: 'catalog-v1' }, products: [], variants: [], categories: cloneSeedCategories() }; } },
      providerRepository: { async listOffers() { return []; } },
    });
    const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' });
    assert.equal(preview.eligible, 0);
    assert.ok(preview.errors[0].errors.includes('MEDIUM_NOT_ESIM'));
    assert.ok(preview.errors[0].errors.includes('SELLING_PRICE_INVALID'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
