import express from 'express';
import { createCatalogPublishService } from './catalogPublishService.js';
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
  console.error('[catalog-publish] Unexpected error');
  return res.status(500).json({
    error: 'Không thể xử lý publish catalog.',
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

const sendCommand = (res, result) => {
  if (result.replayed) res.set('X-Idempotent-Replay', 'true');
  res.status(result.status).json(result.body);
};

export const createCatalogPublishRouter = ({
  catalogPublishService = createCatalogPublishService(),
  catalogGuard = (_req, _res, next) => next(),
} = {}) => {
  const router = express.Router();
  router.use(catalogGuard);
  const routes = [
    ['product', 'publish', true],
    ['product', 'unpublish', false],
    ['variant', 'publish', true],
    ['variant', 'unpublish', false],
  ];
  routes.forEach(([entityType, action, publish]) => {
    const segment = entityType === 'product' ? 'products' : 'variants';
    const parameter = entityType === 'product' ? 'productId' : 'variantId';
    router.post(`/admin/catalog/${segment}/:${parameter}/${action}`, asyncRoute(async (req, res) => {
      const method = `${publish ? '' : 'un'}publish${entityType[0].toUpperCase()}${entityType.slice(1)}`;
      sendCommand(res, await catalogPublishService[method](
        req.params[parameter],
        req.body,
        actorFromRequest(req),
      ));
    }));
  });
  return router;
};
