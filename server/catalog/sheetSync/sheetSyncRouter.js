import express from 'express';
import { verifyPassword } from '../../auth/passwordService.js';
import { createSheetSyncService } from './sheetSyncService.js';
import { createCatalogResyncService } from './catalogResyncService.js';
import { SheetSyncError } from './sheetSyncTypes.js';
import { CatalogPreviewJobError } from './catalogPreviewJobManager.js';

const actor = (req) => ({ id: req.auth?.user?.id, email: req.auth?.user?.email, permission: req.auth?.permissionUsed });
const previewJobDetails = (error) => error.code === 'CATALOG_PREVIEW_IN_PROGRESS' && typeof error.details?.jobId === 'string'
  ? { jobId: error.details.jobId }
  : undefined;
const sendError = (res, error) => {
  if (error instanceof CatalogPreviewJobError) {
    const details = previewJobDetails(error);
    return res.status(error.status).json({ error: error.message, code: error.code, ...(details ? { details } : {}) });
  }
  if (error instanceof SheetSyncError) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
  console.error(`[catalog-sheet-sync] ${error?.name ?? 'UnknownError'}`);
  return res.status(500).json({ error: 'Unable to process catalog Sheet synchronization.', code: 'SHEET_SYNC_FAILED' });
};

const reauth = async (req) => {
  const password = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!password || !req.auth?.rawUser?.passwordHash || !await verifyPassword(password, req.auth.rawUser.passwordHash)) {
    throw new SheetSyncError('Cần xác thực lại Admin trước khi thay thế toàn bộ catalog.', { code: 'ADMIN_REAUTH_FAILED', status: 403 });
  }
};

export const createSheetSyncRouter = ({ sheetSyncService = createSheetSyncService(), resyncService = createCatalogResyncService(), previewJobManager, catalogGuard = (_req, _res, next) => next() } = {}) => {
  const router = express.Router();
  router.use('/admin/catalog-sheet-sync', catalogGuard);
  const startPreview = (req, res, mode) => {
    try {
      if (!previewJobManager) throw new CatalogPreviewJobError('Preview job manager chưa được cấu hình.', { code: 'CATALOG_PREVIEW_MANAGER_UNAVAILABLE', status: 503 });
      const job = previewJobManager.start({ mode, actor: actor(req) });
      return res.status(202).set('Cache-Control', 'no-store').set('Location', `/api/admin/catalog-sheet-sync/preview-jobs/${job.id}`).json({ job });
    } catch (error) { return sendError(res, error); }
  };
  router.post('/admin/catalog-sheet-sync/preview-jobs', (req, res) => startPreview(req, res, req.body?.mode ?? 'legacy'));
  router.get('/admin/catalog-sheet-sync/preview-jobs/active', (req, res) => {
    try { return res.status(200).set('Cache-Control', 'no-store').json({ job: previewJobManager?.active?.() ?? null }); }
    catch (error) { return sendError(res, error); }
  });
  router.get('/admin/catalog-sheet-sync/preview-jobs/:jobId', (req, res) => {
    try { return res.status(200).set('Cache-Control', 'no-store').json({ job: previewJobManager.get(req.params.jobId) }); }
    catch (error) { return sendError(res, error); }
  });
  router.post('/admin/catalog-sheet-sync/preview-jobs/:jobId/cancel', (req, res) => {
    try { return res.status(200).set('Cache-Control', 'no-store').json({ job: previewJobManager.cancel(req.params.jobId) }); }
    catch (error) { return sendError(res, error); }
  });
  router.post('/admin/catalog-sheet-sync/preview', (req, res) => startPreview(req, res, 'legacy'));
  router.post('/admin/catalog-sheet-sync/quick-preview', (req, res) => startPreview(req, res, 'quick'));
  router.post('/admin/catalog-sheet-sync/full-preview', (req, res) => startPreview(req, res, 'full'));
  router.post('/admin/catalog-sheet-sync/:batchId/full-apply', async (req, res) => { try { await reauth(req); res.json(await resyncService.fullApply(req.params.batchId, { actor: actor(req) })); } catch (error) { sendError(res, error); } });
  router.get('/admin/catalog-sheet-sync/:batchId', async (req, res) => { try { res.json(await sheetSyncService.getBatch(req.params.batchId)); } catch (error) { sendError(res, error); } });
  router.get('/admin/catalog-sheet-sync/:batchId/rows', async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(200, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 100));
      const result = await sheetSyncService.listRows(req.params.batchId, { page, pageSize });
      res.json(result);
    } catch (error) { sendError(res, error); }
  });
  router.post('/admin/catalog-sheet-sync/:batchId/apply', async (req, res) => { try { res.json(await sheetSyncService.apply(req.params.batchId, { selection: req.body?.selection, actor: actor(req) })); } catch (error) { sendError(res, error); } });
  router.post('/admin/catalog-sheet-sync/:batchId/quick-apply', async (req, res) => { try { res.json(await sheetSyncService.apply(req.params.batchId, { selection: { rowIds: req.body?.rowIds }, actor: actor(req) })); } catch (error) { sendError(res, error); } });
  router.post('/admin/catalog-sheet-sync/:batchId/reject', async (req, res) => { try { res.json(await sheetSyncService.reject(req.params.batchId, { actor: actor(req) })); } catch (error) { sendError(res, error); } });
  return router;
};
