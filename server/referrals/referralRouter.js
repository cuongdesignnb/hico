import express from 'express';
import { parseCookies } from '../auth/authCookies.js';
import { createRateLimiter } from '../security/rateLimits.js';

const privateResponse = (res) => res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Expires: '0' });
const writes = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const statusFor = {
  REFERRAL_DISABLED: 503,
  REFERRAL_NOT_READY: 503,
  REFERRAL_CODE_INVALID: 400,
  REFERRAL_CODE_CONFLICT: 409,
  REFERRAL_ALREADY_APPLIED: 409,
  REFERRAL_SELF_REFERRAL: 409,
  CUSTOMER_AUTH_REQUIRED: 401,
  CSRF_REQUIRED: 403,
};
const sendError = (res, error) => privateResponse(res)
  .status(statusFor[error?.code] ?? 503)
  .json({ error: error?.message ?? 'Referral rewards are unavailable.', code: error?.code ?? 'REFERRAL_NOT_READY' });

export const createCustomerReferralRouter = ({ customerAuthService, sessionService, readiness, referralService, env = process.env, securityAudit = () => {} } = {}) => {
  const router = express.Router();
  const limiter = createRateLimiter({
    windowMs: Number.parseInt(env.CUSTOMER_RATE_LIMIT_WINDOW_MS, 10) || 900_000,
    max: Number.parseInt(env.CUSTOMER_RATE_LIMIT_REFERRAL_APPLY_MAX, 10) || 5,
    key: (req) => `${req.ip || 'unknown'}:${req.customerAuth?.customer.id ?? 'unknown'}`,
    audit: securityAudit,
  });
  const secure = async (req, res, next) => {
    if ((await readiness.evaluate()).status !== 'healthy') return sendError(res, Object.assign(new Error('Customer authentication is not ready.'), { code: 'REFERRAL_NOT_READY' }));
    try {
      const auth = await customerAuthService.authenticate(parseCookies(req.get('cookie')).hico_customer_session, req.requestId);
      if (auth.status !== 'active') return sendError(res, Object.assign(new Error('Customer authentication is required.'), { code: 'CUSTOMER_AUTH_REQUIRED' }));
      req.customerAuth = auth;
      return next();
    } catch { return sendError(res, Object.assign(new Error('Customer authentication is not ready.'), { code: 'REFERRAL_NOT_READY' })); }
  };
  const csrf = (req, res, next) => {
    if (!writes.has(req.method)) return next();
    const token = req.get('x-csrf-token');
    const cookies = parseCookies(req.get('cookie'));
    if (!token || token !== cookies.hico_customer_csrf || !sessionService.validCsrf(req.customerAuth.session, token)) {
      securityAudit({ event: 'customer_csrf_failed', requestId: req.requestId, actorId: req.customerAuth?.customer.id });
      return sendError(res, Object.assign(new Error('CSRF validation failed.'), { code: 'CSRF_REQUIRED' }));
    }
    return next();
  };

  router.get('/referrals', secure, async (req, res) => {
    try { return privateResponse(res).json(await referralService.overview(req.customerAuth.customer.id)); } catch (error) { return sendError(res, error); }
  });
  router.get('/referrals/code', secure, async (req, res) => {
    try { return privateResponse(res).json(await referralService.code(req.customerAuth.customer.id)); } catch (error) { return sendError(res, error); }
  });
  router.get('/referrals/history', secure, async (req, res) => {
    try { return privateResponse(res).json(await referralService.history(req.customerAuth.customer.id, req.query)); } catch (error) { return sendError(res, error); }
  });
  router.post('/referrals/apply', secure, csrf, limiter, async (req, res) => {
    try {
      const result = await referralService.apply({ customerId: req.customerAuth.customer.id, code: req.body?.code, requestId: req.requestId });
      return privateResponse(res).status(202).json({ accepted: true, status: result.status });
    } catch (error) { return sendError(res, error); }
  });
  return router;
};
