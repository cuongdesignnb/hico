import express from 'express';
import { CHECKOUT_NOT_READY_MESSAGE } from './checkoutHealthService.js';

const unhealthyResponse = (health) => ({
  status: 'unhealthy',
  engine: 'canonical',
  error: CHECKOUT_NOT_READY_MESSAGE,
  code: 'CHECKOUT_NOT_READY',
  ...(health?.blockers?.length ? { blockers: health.blockers } : {}),
});

export const createCheckoutHealthRouter = ({ checkoutHealthService } = {}) => {
  const router = express.Router();
  router.get('/health/checkout', async (_req, res) => {
    const health = await checkoutHealthService.getHealth();
    if (health.status !== 'healthy') return res.status(503).json(unhealthyResponse(health));
    return res.json({
      status: 'healthy',
      engine: health.engine,
      metadata: health.metadata,
      warnings: health.warnings,
    });
  });
  return router;
};
