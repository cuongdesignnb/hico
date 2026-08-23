import { createCatalogPreviewServices } from './catalogPreviewJobWorkerRuntime.js';

const send = (message) => {
  if (process.connected) process.send?.(message);
};

const run = async ({ jobId, mode, actorId, actorEmail }) => {
  let previewPool = null;
  const actor = { id: actorId ?? null, email: actorEmail ?? null };
  const onStage = (stage) => send({ type: 'STAGE', jobId, stage });
  try {
    const services = await createCatalogPreviewServices();
    const { sheetSyncService, resyncService } = services;
    previewPool = services.previewPool;
    onStage('STARTING');
    const result = mode === 'full'
      ? await resyncService.fullPreview({ actor, onStage })
      : await sheetSyncService.preview({ actor, mode, onStage });
    send({ type: 'RESULT', jobId, batch: result.batch });
  } catch (error) {
    send({ type: 'ERROR', jobId, code: error?.code ?? 'CATALOG_PREVIEW_FAILED', message: error?.message ?? 'Không thể hoàn tất preview catalog.', ...(error?.details?.event === 'catalog_preview_persist_failed' ? { details: error.details } : {}) });
  } finally {
    await previewPool?.end?.().catch?.(() => undefined);
    setImmediate(() => process.exit(0));
  }
};

process.on('message', (message) => {
  if (message?.type !== 'START') return;
  void run(message);
});

process.on('disconnect', () => process.exit(0));
