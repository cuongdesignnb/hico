import express from 'express';
import { parseCookies } from '../auth/authCookies.js';
import { createRateLimiter } from '../security/rateLimits.js';

const writes = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const privateResponse = (res) => res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Expires: '0' });
const errorStatus = {
  CUSTOMER_ASSETS_NOT_READY: 503,
  ASSET_NOT_FOUND: 404,
  ESIM_REVEAL_REAUTH_REQUIRED: 428,
  ESIM_SECRET_UNAVAILABLE: 409,
  CSRF_REQUIRED: 403,
};

const sendError = (res, error) => {
  const code = error?.code ?? 'CUSTOMER_ASSETS_NOT_READY';
  return privateResponse(res).status(errorStatus[code] ?? 503).json({ error: error?.message ?? 'Customer assets are unavailable.', code });
};

export const createCustomerAssetRouter = ({ customerAuthService, sessionService, readiness, assetRepository, revealService, env = process.env, securityAudit = () => {} } = {}) => {
  const router = express.Router();
  const secure = async (req, res, next) => {
    if ((await readiness.evaluate()).status !== 'healthy') return sendError(res, Object.assign(new Error('Customer authentication is not ready.'), { code: 'CUSTOMER_ASSETS_NOT_READY' }));
    try {
      const auth = await customerAuthService.authenticate(parseCookies(req.get('cookie')).hico_customer_session, req.requestId);
      if (auth.status !== 'active') return privateResponse(res).status(401).json({ error: 'Customer authentication is required.', code: 'CUSTOMER_AUTH_REQUIRED' });
      req.customerAuth = auth;
      return next();
    } catch { return sendError(res); }
  };
  const csrf = (req, res, next) => {
    if (!writes.has(req.method)) return next();
    const token = req.get('x-csrf-token');
    const cookies = parseCookies(req.get('cookie'));
    if (!req.customerAuth || !token || token !== cookies.hico_customer_csrf || !sessionService.validCsrf(req.customerAuth.session, token)) {
      securityAudit({ event: 'customer_csrf_failed', requestId: req.requestId, actorId: req.customerAuth?.customer.id });
      return sendError(res, Object.assign(new Error('CSRF validation failed.'), { code: 'CSRF_REQUIRED' }));
    }
    return next();
  };
  const revealLimiter = createRateLimiter({
    windowMs: Number.parseInt(env.CUSTOMER_RATE_LIMIT_WINDOW_MS, 10) || 900_000,
    max: Number.parseInt(env.CUSTOMER_RATE_LIMIT_REVEAL_MAX, 10) || 20,
    key: (req) => `${req.ip || 'unknown'}:${req.customerAuth?.customer.id ?? 'unknown'}:${req.params.esimId ?? 'unknown'}`,
    audit: securityAudit,
  });
  const list = (path, assetType) => router.get(path, secure, async (req, res) => {
    try { return privateResponse(res).json(await assetRepository.list(req.customerAuth.customer.id, assetType, req.query)); }
    catch (error) { return sendError(res, error); }
  });
  const detail = (path) => router.get(path, secure, async (req, res) => {
    try { return privateResponse(res).json({ asset: await assetRepository.get(req.customerAuth.customer.id, req.params.assetId ?? req.params.esimId ?? req.params.topupId) }); }
    catch (error) { return sendError(res, error); }
  });

  router.get('/assets/summary', secure, async (req, res) => {
    try { return privateResponse(res).json(await assetRepository.summary(req.customerAuth.customer.id)); }
    catch (error) { return sendError(res, error); }
  });
  list('/esims', 'ESIM');
  detail('/esims/:esimId');
  router.post('/esims/:esimId/reveal', secure, csrf, revealLimiter, async (req, res) => {
    try {
      const result = await revealService.reveal({ customerId: req.customerAuth.customer.id, session: req.customerAuth.session, assetId: req.params.esimId, requestId: req.requestId });
      return privateResponse(res).json(result);
    } catch (error) { return sendError(res, error); }
  });
  list('/physical-sims', 'PHYSICAL_SIM');
  detail('/physical-sims/:assetId');
  list('/devices', 'DEVICE');
  detail('/devices/:assetId');
  list('/topups', 'TOPUP');
  detail('/topups/:topupId');
  return router;
};
