import express from 'express';
import { verifyPassword } from '../../auth/passwordService.js';
import { CatalogResetError } from './catalogResetService.js';

const actor = (req) => ({ id: req.auth?.user?.id, email: req.auth?.user?.email, permission: req.auth?.permissionUsed });
const sendError = (res, error) => {
  if (error instanceof CatalogResetError) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
  if (error?.status && error?.code) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
  console.error('[catalog-reset] Unexpected error');
  return res.status(500).json({ error: 'Không thể xử lý reset catalog.', code: 'CATALOG_RESET_FAILED' });
};
const reauth = async (req) => {
  const password = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!password || !req.auth?.rawUser?.passwordHash || !await verifyPassword(password, req.auth.rawUser.passwordHash)) {
    throw new CatalogResetError('Cần xác thực lại Admin trước thao tác thay đổi toàn bộ catalog.', { code: 'ADMIN_REAUTH_FAILED', status: 403 });
  }
};

export const createCatalogResetRouter = ({ catalogResetService, catalogGuard = (_req, _res, next) => next() } = {}) => {
  const router = express.Router();
  router.use('/admin/catalog/reset', catalogGuard);
  router.get('/admin/catalog/reset/preview', async (_req, res) => {
    try { return res.json(await catalogResetService.preview()); } catch (error) { return sendError(res, error); }
  });
  router.post('/admin/catalog/reset', async (req, res) => {
    try {
      await reauth(req);
      const result = await catalogResetService.reset({ request: req.body ?? {}, actor: actor(req) });
      if (result.replayed) res.set('X-Idempotent-Replay', 'true');
      return res.status(result.status).json(result.body);
    } catch (error) { return sendError(res, error); }
  });
  return router;
};
