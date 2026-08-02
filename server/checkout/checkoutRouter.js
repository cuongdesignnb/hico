import express from 'express';
import { readCheckoutEngine } from './checkoutValidation.js';
import { CheckoutError, sendCheckoutError } from './checkoutError.js';

export const createCheckoutRouter = ({
  checkoutService,
  fulfillmentService,
  orderRepository,
  catalogHealthService,
  canonicalRepository,
  checkoutHealthService,
  env = process.env,
} = {}) => {
  const router = express.Router();
  const engine = readCheckoutEngine(env);
  const requireReadyCanonical = (handler) => async (req, res) => {
    if (engine !== 'canonical') return res.status(409).json({ error: 'Canonical checkout is disabled.', code: 'CHECKOUT_ENGINE_DISABLED' });
    if (checkoutHealthService) {
      const health = await checkoutHealthService.getHealth();
      if (health.status !== 'healthy') return res.status(503).json({ error: 'Canonical checkout validation failed.', code: 'CHECKOUT_NOT_READY' });
    }
    try { return res.json(await handler(req)); } catch (error) { return sendCheckoutError(res, error); }
  };
  const handleExistingOrder = (handler) => async (req, res) => {
    try { return res.json(await handler(req)); } catch (error) { return sendCheckoutError(res, error); }
  };

  router.get('/checkout/config', (req, res) => res.json({ engine, canonicalCheckout: engine === 'canonical' }));
  router.get('/admin/catalog/source-status', async (_req, res) => {
    const health = catalogHealthService ? await catalogHealthService.getHealth() : null;
    const manifest = canonicalRepository ? await canonicalRepository.readCurrentManifest() : null;
    return res.json({
      readSource: env.CATALOG_READ_SOURCE ?? 'canonical',
      legacyWriteEnabled: (env.CATALOG_READ_SOURCE ?? 'canonical') === 'legacy',
      canonicalWriteEnabled: (env.CATALOG_READ_SOURCE ?? 'canonical') === 'canonical',
      canonicalVersion: health?.versionId ?? null,
      canonicalChecksum: manifest?.businessChecksum ?? null,
      rollbackAvailable: Boolean(health?.legacyRollbackAvailable),
      checkoutEngine: engine,
    });
  });
  router.post('/checkout/validate', requireReadyCanonical((req) => checkoutService.validate(req.body)));
  router.post('/checkout/orders', requireReadyCanonical((req) => checkoutService.createOrder(req.body)));
  router.get('/checkout/orders/:orderId', handleExistingOrder(async (req) => {
    const order = await orderRepository.get(req.params.orderId);
    if (!order) throw new CheckoutError('Order not found.', 'ORDER_NOT_FOUND', 404);
    return order;
  }));
  router.post('/checkout/orders/:orderId/retry-fulfillment', handleExistingOrder((req) => fulfillmentService.retry(req.params.orderId)));
  return router;
};
