import express from 'express';
import { parseCookies } from './authCookies.js';
import { createCsrfProtection } from '../security/authenticate.js';
import { createRateLimiter } from '../security/rateLimits.js';

const loginError = (res) => res.status(401).json({ error: 'Email or password is incorrect.', code: 'AUTH_INVALID_CREDENTIALS' });

export const createAuthRouter = ({ authService, sessionService, authCookies, env = process.env, securityAudit = () => {} }) => {
  const router = express.Router();
  const loginLimiter = createRateLimiter({
    windowMs: Number.parseInt(env.RATE_LIMIT_LOGIN_WINDOW_MS, 10) || 900_000,
    max: Number.parseInt(env.RATE_LIMIT_LOGIN_MAX, 10) || 10,
    key: (req) => `${req.ip || 'unknown'}:${String(req.body?.email ?? '').trim().toLowerCase()}`,
    audit: securityAudit,
  });
  const authenticated = async (req, res, next) => {
    let result;
    try { result = await authService.authenticate(parseCookies(req.get('cookie')).hico_admin_session); }
    catch {
      securityAudit({ event: 'auth_store_unavailable', requestId: req.requestId });
      return res.status(503).json({ error: 'Authentication service is unavailable.', code: 'AUTH_STORE_UNAVAILABLE' });
    }
    if (result.status !== 'active') return res.status(401).json({ error: result.status === 'expired' ? 'Session expired.' : 'Authentication is required.', code: result.status === 'expired' ? 'SESSION_EXPIRED' : 'AUTH_REQUIRED' });
    req.auth = { user: result.user, rawUser: result.rawUser, session: result.session };
    return next();
  };
  const csrf = createCsrfProtection({ sessionService, securityAudit });

  router.post('/login', loginLimiter, async (req, res) => {
    let result;
    try { result = await authService.login(req.body ?? {}); }
    catch {
      securityAudit({ event: 'auth_store_unavailable', requestId: req.requestId });
      return res.status(503).json({ error: 'Authentication service is unavailable.', code: 'AUTH_STORE_UNAVAILABLE' });
    }
    if (!result) return loginError(res);
    authCookies.set(res, result.credentials);
    return res.json({ user: result.user, csrfToken: result.credentials.csrfToken });
  });
  router.get('/me', authenticated, (req, res) => {
    const csrfToken = parseCookies(req.get('cookie')).hico_csrf;
    return res.json({ user: req.auth.user, csrfToken });
  });
  router.post('/refresh', authenticated, csrf, async (req, res) => {
    const credentials = await sessionService.rotate(req.auth.session);
    if (!credentials) return res.status(401).json({ error: 'Session expired.', code: 'SESSION_EXPIRED' });
    authCookies.set(res, credentials);
    return res.json({ user: req.auth.user, csrfToken: credentials.csrfToken });
  });
  router.post('/logout', authenticated, csrf, async (req, res) => {
    await sessionService.revoke(req.auth.session, 'logout');
    authCookies.clear(res);
    securityAudit({ event: 'auth_logout', actorId: req.auth.user.id });
    return res.status(204).end();
  });
  router.post('/change-password', authenticated, csrf, async (req, res) => {
    const changed = await authService.changePassword(req.auth.rawUser, req.body?.currentPassword, req.body?.nextPassword);
    if (!changed) return res.status(401).json({ error: 'Current password is incorrect.', code: 'AUTH_INVALID_CREDENTIALS' });
    authCookies.clear(res);
    return res.status(204).end();
  });
  return router;
};
