import express from 'express';
import {
  CATALOG_NOT_READY_MESSAGE,
  createCatalogHealthService,
} from './catalogHealthService.js';

const unhealthyResponse = (health) => ({
  status: 'not_ready',
  catalog: 'unhealthy',
  error: CATALOG_NOT_READY_MESSAGE,
  code: 'CATALOG_NOT_READY',
  ...(health.failureCode ? { failureCode: health.failureCode } : {}),
});

export const createCatalogHealthRouter = ({
  catalogHealthService = createCatalogHealthService(),
} = {}) => {
  const router = express.Router();

  router.get('/health/live', (_req, res) => {
    res.json({ status: 'alive' });
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'alive' });
  });

  router.get('/health/ready', async (_req, res) => {
    const health = await catalogHealthService.getHealth();
    if (health.status !== 'healthy') return res.status(503).json(unhealthyResponse(health));
    return res.json({ status: 'ready', catalog: 'healthy' });
  });

  router.get('/health/catalog', async (_req, res) => {
    const health = await catalogHealthService.getHealth();
    if (health.status !== 'healthy') return res.status(503).json(unhealthyResponse(health));
    return res.json(health);
  });

  return router;
};

export const createCanonicalCatalogGuard = ({ catalogHealthService }) => (
  async (_req, res, next) => {
    if (!catalogHealthService.isCanonicalSource()) return next();
    try {
      await catalogHealthService.assertHealthy();
      return next();
    } catch (error) {
      if (error?.code === 'CATALOG_NOT_READY') {
        return res.status(503).json({
          error: CATALOG_NOT_READY_MESSAGE,
          code: 'CATALOG_NOT_READY',
        });
      }
      console.error('[catalog-health] Guard failure');
      return res.status(503).json({
        error: CATALOG_NOT_READY_MESSAGE,
        code: 'CATALOG_NOT_READY',
      });
    }
  }
);
