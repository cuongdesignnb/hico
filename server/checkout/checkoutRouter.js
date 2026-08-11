import express from 'express';
import { readCheckoutEngine } from './checkoutValidation.js';
import { CheckoutError, sendCheckoutError } from './checkoutError.js';
import { parseCookies } from '../auth/authCookies.js';

export const createCheckoutRouter = ({
  checkoutService,
  fulfillmentService,
  orderRepository,
  catalogHealthService,
  canonicalRepository,
  checkoutHealthService,
  checkoutReadinessService = null,
  customerAuthService,
  env = process.env,
  logger = console,
} = {}) => {
  const router = express.Router();
  const engine = readCheckoutEngine(env);
  const requireReadyCanonical = (handler) => async (req, res) => {
    if (engine !== 'canonical') return res.status(409).json({ error: 'Canonical checkout is disabled.', code: 'CHECKOUT_ENGINE_DISABLED' });
    try {
      if (checkoutReadinessService) {
        await checkoutReadinessService.assertReady(req.body);
      } else if (checkoutHealthService) {
        const health = await checkoutHealthService.getHealth();
        if (health.status !== 'healthy') return res.status(503).json({ error: 'Canonical checkout validation failed.', code: 'CHECKOUT_NOT_READY' });
      }
      return res.json(await handler(req));
    } catch (error) {
      if (error?.code === 'CHECKOUT_NOT_READY') logger.warn?.(JSON.stringify({ event: 'checkout_request_blocked', cartKinds: error.details?.cartKinds ?? [], requiredCapabilities: error.details?.requiredCapabilities ?? [], blockingReasons: error.details?.blockingReasons ?? [] }));
      return sendCheckoutError(res, error);
    }
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
  router.post('/checkout/orders', requireReadyCanonical(async (req) => {
    const token = parseCookies(req.get('cookie')).hico_customer_session;
    if (!token) return checkoutService.createOrder(req.body);
    if (!customerAuthService) throw new CheckoutError('Customer authentication is unavailable.', 'CUSTOMER_AUTH_NOT_READY', 503);
    const auth = await customerAuthService.authenticate(token, req.requestId);
    if (auth.status !== 'active') throw new CheckoutError('Customer authentication is required.', 'CUSTOMER_AUTH_REQUIRED', 401);
    return checkoutService.createOrder(req.body, auth.customer);
  }));
  router.post('/admin/orders/:orderId/retry-fulfillment', handleExistingOrder((req) => fulfillmentService.retry(req.params.orderId)));
  return router;
};
