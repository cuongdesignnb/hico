import { createSheetSyncRepository } from './sheetSyncRepository.js';

const run = async (message) => {
  const repository = createSheetSyncRepository({ storageFile: process.env.CATALOG_PREVIEW_TEST_STORAGE_FILE });
  const createdAt = new Date().toISOString();
  const batch = {
    id: 'batch-worker-persisted',
    mode: message.mode,
    sourceHash: 'worker-source-hash',
    spreadsheetId: 'spreadsheet-test',
    sheetTab: 'HICO GỐC',
    sheetRange: 'A1:X3',
    status: 'READY_FOR_REVIEW',
    createdBy: message.actorId ?? null,
    createdAt,
    validatedAt: createdAt,
    summary: { total: 3, valid: 3, invalid: 0 },
  };
  const rows = [1, 2, 3].map((sheetRowNumber) => ({
    id: `row-worker-${sheetRowNumber}`,
    batchId: batch.id,
    sheetRowNumber,
    rowHash: `row-hash-${sheetRowNumber}`,
    variantId: `variant-${sheetRowNumber}`,
    status: 'VALID',
    normalizedData: { productName: `Product ${sheetRowNumber}` },
    raw: {},
    diff: {},
    errors: [],
    appliedFields: [],
    createdAt,
  }));
  await repository.createBatch(batch, rows);
  process.send?.({ type: 'RESULT', jobId: message.jobId, batch });
  setTimeout(() => process.exit(0), 10);
};

process.on('message', (message) => {
  if (message?.type !== 'START') return;
  void run(message).catch((error) => {
    process.send?.({ type: 'ERROR', jobId: message.jobId, code: error?.code ?? 'CATALOG_PREVIEW_FAILED', message: error?.message });
    setImmediate(() => process.exit(0));
  });
});
