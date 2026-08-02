import express from 'express';
import { parseCookies } from '../auth/authCookies.js';
import { createRateLimiter } from '../security/rateLimits.js';

const writes = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const invalidCredentials = (res) => res.status(401).json({ error: 'Thong tin dang nhap khong hop le.', code: 'INVALID_CREDENTIALS' });
const toError = (res, error) => {
  const code = error?.code ?? 'CUSTOMER_AUTH_NOT_READY';
  const status = {
    CUSTOMER_ALREADY_EXISTS: 409,
    INVALID_CREDENTIALS: 401,
    CUSTOMER_AUTH_REQUIRED: 401,
    CUSTOMER_SESSION_INVALID: 401,
    CUSTOMER_SESSION_REVOKED: 401,
    CUSTOMER_REFRESH_REPLAYED: 401,
    PASSWORD_RESET_TOKEN_INVALID: 400,
    PASSWORD_RESET_TOKEN_EXPIRED: 410,
    VERIFICATION_TOKEN_INVALID: 400,
    VERIFICATION_TOKEN_EXPIRED: 410,
    VALIDATION_ERROR: 400,
    CSRF_REQUIRED: 403,
  }[code] ?? 503;
  return res.status(status).json({ error: error?.message ?? 'Customer authentication is unavailable.', code });
};

export const createCustomerAuthRouter = ({
  customerAuthService,
  sessionService,
  authCookies,
  readiness,
  env = process.env,
  securityAudit = () => {},
} = {}) => {
  const router = express.Router();
  const limiter = (name, fallback) => createRateLimiter({
    windowMs: Number.parseInt(env.CUSTOMER_RATE_LIMIT_WINDOW_MS, 10) || 900_000,
    max: Number.parseInt(env[name], 10) || fallback,
    key: (req) => `${req.ip || 'unknown'}:${String(req.body?.email ?? '').trim().toLowerCase()}`,
    audit: securityAudit,
  });
  const requireReady = async (_req, res, next) => {
    const status = await readiness.evaluate();
    if (status.status === 'healthy') return next();
    return res.status(503).json({
      error: 'Customer authentication is not ready.',
      code: status.blockers.includes('CUSTOMER_ACCOUNT_MODE_INVALID') ? 'CUSTOMER_ACCOUNT_MODE_INVALID' : 'CUSTOMER_AUTH_NOT_READY',
    });
  };
  const authenticated = async (req, res, next) => {
    try {
      const result = await customerAuthService.authenticate(parseCookies(req.get('cookie')).hico_customer_session, req.requestId);
      if (result.status !== 'active') {
        return res.status(401).json({ error: 'Customer authentication is required.', code: result.status === 'revoked' ? 'CUSTOMER_SESSION_REVOKED' : 'CUSTOMER_AUTH_REQUIRED' });
      }
      req.customerAuth = result;
      return next();
    } catch {
      return res.status(503).json({ error: 'Customer authentication is unavailable.', code: 'CUSTOMER_AUTH_NOT_READY' });
    }
  };
  const csrf = (req, res, next) => {
    if (!writes.has(req.method)) return next();
    const csrfToken = req.get('x-csrf-token');
    const cookies = parseCookies(req.get('cookie'));
    if (!req.customerAuth || !csrfToken || csrfToken !== cookies.hico_customer_csrf || !sessionService.validCsrf(req.customerAuth.session, csrfToken)) {
      securityAudit({ event: 'customer_csrf_failed', requestId: req.requestId, actorId: req.customerAuth?.customer.id });
      return res.status(403).json({ error: 'CSRF validation failed.', code: 'CSRF_REQUIRED' });
    }
    return next();
  };
  const secured = [requireReady, authenticated];
  const securedWrite = [requireReady, authenticated, csrf];

  router.post('/auth/register', requireReady, limiter('CUSTOMER_RATE_LIMIT_REGISTER_MAX', 5), async (req, res) => {
    try {
      const result = await customerAuthService.register({ ...req.body, requestId: req.requestId });
      return res.status(201).json({ customer: result.customer, verificationRequired: true });
    } catch (error) {
      return toError(res, error);
    }
  });
  router.post('/auth/login', requireReady, limiter('CUSTOMER_RATE_LIMIT_LOGIN_MAX', 10), async (req, res) => {
    try {
      const result = await customerAuthService.login({ ...req.body, requestId: req.requestId });
      if (!result) return invalidCredentials(res);
      authCookies.set(res, result.credentials);
      return res.json({ customer: result.customer, csrfToken: result.credentials.csrfToken });
    } catch (error) {
      return toError(res, error);
    }
  });
  router.post('/auth/logout', ...securedWrite, async (req, res) => {
    await customerAuthService.logout(req.customerAuth.session, req.customerAuth.customer.id, req.requestId);
    authCookies.clear(res);
    return res.status(204).end();
  });
  router.post('/auth/refresh', ...securedWrite, async (req, res) => {
    const credentials = await customerAuthService.refresh(req.customerAuth.session, req.customerAuth.customer.id, req.requestId);
    if (!credentials) return res.status(401).json({ error: 'Customer session is invalid.', code: 'CUSTOMER_REFRESH_REPLAYED' });
    authCookies.set(res, credentials);
    return res.json({ customer: req.customerAuth.customer, csrfToken: credentials.csrfToken });
  });
  router.post('/auth/request-password-reset', requireReady, limiter('CUSTOMER_RATE_LIMIT_PASSWORD_RESET_MAX', 5), async (req, res) => {
    try {
      await customerAuthService.requestPasswordReset({ ...req.body, requestId: req.requestId });
      return res.status(202).json({ accepted: true });
    } catch {
      return res.status(202).json({ accepted: true });
    }
  });
  router.post('/auth/reset-password', requireReady, async (req, res) => {
    try {
      await customerAuthService.resetPassword({ ...req.body, requestId: req.requestId });
      return res.status(204).end();
    } catch (error) {
      return toError(res, error);
    }
  });
  router.post('/auth/verify-email', requireReady, limiter('CUSTOMER_RATE_LIMIT_VERIFICATION_MAX', 5), async (req, res) => {
    try {
      await customerAuthService.verifyEmail({ ...req.body, requestId: req.requestId });
      return res.status(204).end();
    } catch (error) {
      return toError(res, error);
    }
  });
  router.get('/me', ...secured, (req, res) => {
    const csrfToken = parseCookies(req.get('cookie')).hico_customer_csrf;
    return res.set('Cache-Control', 'no-store').json({ customer: req.customerAuth.customer, csrfToken });
  });
  router.get('/sessions', ...secured, async (req, res) => res.set('Cache-Control', 'no-store').json({ sessions: await customerAuthService.listSessions(req.customerAuth.customer.id) }));
  router.delete('/sessions/:sessionId', ...securedWrite, async (req, res) => {
    const revoked = await customerAuthService.revokeSession(req.params.sessionId, req.customerAuth.customer.id, req.requestId);
    if (!revoked) return res.status(404).json({ error: 'Customer session was not found.', code: 'CUSTOMER_SESSION_INVALID' });
    if (revoked.id === req.customerAuth.session.id) authCookies.clear(res);
    return res.status(204).end();
  });
  router.post('/sessions/logout-all', ...securedWrite, async (req, res) => {
    await customerAuthService.logoutAll(req.customerAuth.customer.id, req.requestId);
    authCookies.clear(res);
    return res.status(204).end();
  });
  return router;
};
