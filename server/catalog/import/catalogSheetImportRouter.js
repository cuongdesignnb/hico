import express from 'express';
import { createCatalogSheetImportService } from './catalogSheetImportService.js';
import { CatalogWriteError } from '../write/catalogWriteValidation.js';

const actor = (req) => ({ id: req.auth?.user.id, email: req.auth?.user.email, permission: req.auth?.permissionUsed });
const route = (handler) => async (req, res) => { try { await handler(req, res); } catch (error) { if (error instanceof CatalogWriteError) return res.status(error.status).json({ error: error.message, code: error.code, details: error.details }); console.error('[catalog-import] Unexpected error'); return res.status(500).json({ error: 'Không thể xử lý import catalog.', code: 'INTERNAL_ERROR' }); } };

export const createCatalogSheetImportRouter = ({ service = createCatalogSheetImportService(), catalogGuard = (_req, _res, next) => next() } = {}) => {
  const router = express.Router();
  router.use('/admin/catalog/import', catalogGuard);
  router.post('/admin/catalog/import/preview', route(async (req, res) => res.json(await service.preview(req.body, actor(req)))));
  router.post('/admin/catalog/import/execute', route(async (req, res) => { const result = await service.execute(req.body, actor(req)); if (result.replayed) res.set('X-Idempotent-Replay', 'true'); res.status(result.status).json(result.body); }));
  return router;
};
