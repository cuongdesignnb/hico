import express from 'express';
import { createCatalogWriteService } from './catalogWriteService.js';
import { CatalogWriteError } from './catalogWriteValidation.js';

const actorFromRequest = (req) => ({
  id: req.auth?.user.id,
  role: req.auth?.user.roles?.join(','),
  email: req.auth?.user.email,
  permission: req.auth?.permissionUsed,
  sessionIdHash: req.auth?.sessionIdHash,
});

const queryPage = (req) => ({
  offset: Math.max(0, Number.parseInt(req.query.offset, 10) || 0),
  limit: Math.min(
    200,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 100),
  ),
});

const sendCommand = (res, result) => {
  if (result.replayed) res.set('X-Idempotent-Replay', 'true');
  return res.status(result.status).json(result.body);
};

const sendError = (res, error) => {
  if (error instanceof CatalogWriteError) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.details ? { details: error.details } : {}),
    });
  }
  console.error('[catalog-write] Unexpected error');
  return res.status(500).json({
    error: 'Không thể xử lý yêu cầu catalog.',
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

export const createCatalogWriteRouter = ({
  catalogWriteService = createCatalogWriteService(),
  catalogGuard = (_req, _res, next) => next(),
} = {}) => {
  const router = express.Router();
  router.use(catalogGuard);

  router.post('/admin/catalog/products', asyncRoute(async (req, res) => {
    sendCommand(res, await catalogWriteService.createProduct(
      req.body,
      actorFromRequest(req),
    ));
  }));

  router.get('/admin/catalog/products/:productId', asyncRoute(async (req, res) => {
    res.json(await catalogWriteService.getProduct(req.params.productId));
  }));

  router.put('/admin/catalog/products/:productId', asyncRoute(async (req, res) => {
    sendCommand(res, await catalogWriteService.updateProduct(
      req.params.productId,
      req.body,
      actorFromRequest(req),
    ));
  }));

  router.delete('/admin/catalog/products/:productId', asyncRoute(
    async (req, res) => {
      sendCommand(res, await catalogWriteService.deleteProduct(
        req.params.productId,
        req.body,
        actorFromRequest(req),
      ));
    },
  ));

  router.post('/admin/catalog/products/:productId/archive', asyncRoute(
    async (req, res) => {
      sendCommand(res, await catalogWriteService.setProductArchived(
        req.params.productId,
        req.body,
        true,
        actorFromRequest(req),
      ));
    },
  ));

  router.post('/admin/catalog/products/:productId/restore', asyncRoute(
    async (req, res) => {
      sendCommand(res, await catalogWriteService.setProductArchived(
        req.params.productId,
        req.body,
        false,
        actorFromRequest(req),
      ));
    },
  ));

  router.post('/admin/catalog/products/:productId/variants', asyncRoute(
    async (req, res) => {
      sendCommand(res, await catalogWriteService.createVariant(
        req.params.productId,
        req.body,
        actorFromRequest(req),
      ));
    },
  ));

  router.get(
    '/admin/catalog/products/:productId/variants/:variantId',
    asyncRoute(async (req, res) => {
      res.json(await catalogWriteService.getVariant(
        req.params.productId,
        req.params.variantId,
      ));
    }),
  );

  router.put(
    '/admin/catalog/products/:productId/variants/:variantId',
    asyncRoute(async (req, res) => {
      sendCommand(res, await catalogWriteService.updateVariant(
        req.params.productId,
        req.params.variantId,
        req.body,
        actorFromRequest(req),
      ));
    }),
  );

  router.delete(
    '/admin/catalog/products/:productId/variants/:variantId',
    asyncRoute(async (req, res) => {
      sendCommand(res, await catalogWriteService.deleteVariant(
        req.params.productId,
        req.params.variantId,
        req.body,
        actorFromRequest(req),
      ));
    }),
  );

  router.post(
    '/admin/catalog/products/:productId/variants/:variantId/archive',
    asyncRoute(async (req, res) => {
      sendCommand(res, await catalogWriteService.setVariantArchived(
        req.params.productId,
        req.params.variantId,
        req.body,
        true,
        actorFromRequest(req),
      ));
    }),
  );

  router.post(
    '/admin/catalog/products/:productId/variants/:variantId/restore',
    asyncRoute(async (req, res) => {
      sendCommand(res, await catalogWriteService.setVariantArchived(
        req.params.productId,
        req.params.variantId,
        req.body,
        false,
        actorFromRequest(req),
      ));
    }),
  );

  router.post('/admin/catalog/products/:productId/validate', asyncRoute(
    async (req, res) => {
      res.json(await catalogWriteService.validateProduct(req.params.productId));
    },
  ));

  router.post(
    '/admin/catalog/products/:productId/publish-readiness',
    asyncRoute(async (req, res) => {
      res.json(await catalogWriteService.productReadiness(req.params.productId));
    }),
  );

  router.post(
    '/admin/catalog/variants/:variantId/publish-readiness',
    asyncRoute(async (req, res) => {
      res.json(await catalogWriteService.variantReadiness(req.params.variantId));
    }),
  );

  router.get('/admin/catalog/versions', asyncRoute(async (_req, res) => {
    res.json(await catalogWriteService.listVersions());
  }));

  router.get('/admin/catalog/versions/:versionId', asyncRoute(
    async (req, res) => {
      res.json(await catalogWriteService.getVersion(req.params.versionId));
    },
  ));

  router.post('/admin/catalog/versions/:versionId/rollback', asyncRoute(
    async (req, res) => {
      sendCommand(res, await catalogWriteService.rollback(
        req.params.versionId,
        req.body,
        actorFromRequest(req),
      ));
    },
  ));

  router.get('/admin/catalog/audit', asyncRoute(async (req, res) => {
    res.json(await catalogWriteService.listAudit(queryPage(req)));
  }));

  router.get(
    '/admin/catalog/audit/:entityType/:entityId',
    asyncRoute(async (req, res) => {
      res.json(await catalogWriteService.listEntityAudit(
        req.params.entityType,
        req.params.entityId,
        queryPage(req),
      ));
    }),
  );

  return router;
};
