import express from 'express';
import { createCatalogBulkService } from './catalogBulkService.js';
import { CatalogWriteError } from '../write/catalogWriteValidation.js';

const actorFromRequest = (req) => ({
  id: req.auth?.user.id,
  role: req.auth?.user.roles?.join(','),
  email: req.auth?.user.email,
  permission: req.auth?.permissionUsed,
  sessionIdHash: req.auth?.sessionIdHash,
});

const sendError = (res, error) => {
  if (error instanceof CatalogWriteError) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.details ? { details: error.details } : {}),
    });
  }
  console.error('[catalog-bulk] Unexpected error');
  return res.status(500).json({
    error: 'Không thể xử lý bulk catalog.',
    code: 'INTERNAL_ERROR',
  });
};

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(res, error);
  }
};

export const createCatalogBulkRouter = ({
  catalogBulkService = createCatalogBulkService(),
  catalogGuard = (_req, _res, next) => next(),
} = {}) => {
  const router = express.Router();
  router.use((req, res, next) => req.path.startsWith('/admin/catalog/') ? catalogGuard(req, res, next) : next());

  router.post('/admin/catalog/bulk/preview', asyncRoute(async (req, res) => {
    res.json(await catalogBulkService.preview(req.body, actorFromRequest(req)));
  }));

  router.post('/admin/catalog/bulk/execute', asyncRoute(async (req, res) => {
    const result = await catalogBulkService.execute(req.body, actorFromRequest(req));
    if (result.replayed) res.set('X-Idempotent-Replay', 'true');
    res.status(result.status).json(result.body);
  }));

  return router;
};
