import express from 'express';
import { createCatalogQueueService } from './catalogQueueService.js';
import { CatalogWriteError } from '../write/catalogWriteValidation.js';

const sendError = (res, error) => {
  if (error instanceof CatalogWriteError) {
    return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }
  console.error('[catalog-queues] Unexpected error');
  return res.status(500).json({ error: 'Không thể đọc queue catalog.', code: 'INTERNAL_ERROR' });
};

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(res, error);
  }
};

export const createCatalogQueueRouter = ({
  catalogQueueService = createCatalogQueueService(),
  catalogGuard = (_req, _res, next) => next(),
} = {}) => {
  const router = express.Router();
  router.use(catalogGuard);
  const routes = [
    ['sku-conflicts', 'listSkuConflicts'],
    ['needs-review', 'listNeedsReview'],
    ['provider-issues', 'listProviderIssues'],
    ['inventory-warnings', 'listInventoryWarnings'],
  ];
  routes.forEach(([segment, method]) => {
    router.get(`/admin/catalog/queues/${segment}`, asyncRoute(async (req, res) => {
      res.json(await catalogQueueService[method](req.query));
    }));
  });
  return router;
};
