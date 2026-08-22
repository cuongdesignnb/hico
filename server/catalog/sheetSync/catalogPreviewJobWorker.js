import { createCatalogPreviewServices } from './catalogPreviewJobWorkerRuntime.js';

const send = (message) => {
  if (process.connected) process.send?.(message);
};

const run = async ({ jobId, mode, actorId, actorEmail }) => {
  const { sheetSyncService, resyncService, authPool } = createCatalogPreviewServices();
  const actor = { id: actorId ?? null, email: actorEmail ?? null };
  const onStage = (stage) => send({ type: 'STAGE', jobId, stage });
  try {
    onStage('STARTING');
    const result = mode === 'full'
      ? await resyncService.fullPreview({ actor, onStage })
      : await sheetSyncService.preview({ actor, mode, onStage });
    send({ type: 'RESULT', jobId, batch: result.batch });
  } catch (error) {
    send({ type: 'ERROR', jobId, code: error?.code ?? 'CATALOG_PREVIEW_FAILED', message: error?.message ?? 'Không thể hoàn tất preview catalog.' });
  } finally {
    await authPool?.end?.().catch?.(() => undefined);
    setImmediate(() => process.exit(0));
  }
};

process.on('message', (message) => {
  if (message?.type !== 'START') return;
  void run(message);
});

process.on('disconnect', () => process.exit(0));
