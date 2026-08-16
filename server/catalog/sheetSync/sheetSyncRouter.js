import express from 'express';
import { verifyPassword } from '../../auth/passwordService.js';
import { createSheetSyncService } from './sheetSyncService.js';
import { createCatalogResyncService } from './catalogResyncService.js';
import { SheetSyncError } from './sheetSyncTypes.js';

const actor = (req) => ({ id: req.auth?.user?.id, email: req.auth?.user?.email, permission: req.auth?.permissionUsed });
const sendError = (res, error) => {
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

export const createSheetSyncRouter = ({ sheetSyncService = createSheetSyncService(), resyncService = createCatalogResyncService(), catalogGuard = (_req, _res, next) => next() } = {}) => {
  const router = express.Router();
  router.use('/admin/catalog-sheet-sync', catalogGuard);
  router.post('/admin/catalog-sheet-sync/preview', async (req, res) => { try { res.json(await sheetSyncService.preview({ actor: actor(req) })); } catch (error) { sendError(res, error); } });
  router.post('/admin/catalog-sheet-sync/quick-preview', async (req, res) => { try { res.json(await sheetSyncService.preview({ actor: actor(req), mode: 'quick' })); } catch (error) { sendError(res, error); } });
  router.post('/admin/catalog-sheet-sync/full-preview', async (req, res) => { try { res.json(await resyncService.fullPreview({ actor: actor(req) })); } catch (error) { sendError(res, error); } });
  router.post('/admin/catalog-sheet-sync/:batchId/full-apply', async (req, res) => { try { await reauth(req); res.json(await resyncService.fullApply(req.params.batchId, { actor: actor(req) })); } catch (error) { sendError(res, error); } });
  router.get('/admin/catalog-sheet-sync/:batchId', async (req, res) => { try { res.json(await sheetSyncService.getBatch(req.params.batchId)); } catch (error) { sendError(res, error); } });
  router.get('/admin/catalog-sheet-sync/:batchId/rows', async (req, res) => { try { res.json({ items: await sheetSyncService.listRows(req.params.batchId) }); } catch (error) { sendError(res, error); } });
  router.post('/admin/catalog-sheet-sync/:batchId/apply', async (req, res) => { try { res.json(await sheetSyncService.apply(req.params.batchId, { selection: req.body?.selection, actor: actor(req) })); } catch (error) { sendError(res, error); } });
  router.post('/admin/catalog-sheet-sync/:batchId/quick-apply', async (req, res) => { try { res.json(await sheetSyncService.apply(req.params.batchId, { selection: { rowIds: req.body?.rowIds }, actor: actor(req) })); } catch (error) { sendError(res, error); } });
  router.post('/admin/catalog-sheet-sync/:batchId/reject', async (req, res) => { try { res.json(await sheetSyncService.reject(req.params.batchId, { actor: actor(req) })); } catch (error) { sendError(res, error); } });
  return router;
};
