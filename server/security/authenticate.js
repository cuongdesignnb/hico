import { parseCookies } from '../auth/authCookies.js';
import { hasPermission } from './permissions.js';
import { permissionForAdminRequest } from './adminPermissions.js';

export const createAuthenticate = ({ authService, sessionService, securityAudit = () => {} }) => async (req, res, next) => {
  let result;
  try { result = await authService.authenticate(parseCookies(req.get('cookie')).hico_admin_session); }
  catch {
    securityAudit({ event: 'auth_store_unavailable', requestId: req.requestId });
    return res.status(503).json({ error: 'Authentication service is unavailable.', code: 'AUTH_STORE_UNAVAILABLE' });
  }
  if (result.status !== 'active') {
    const code = result.status === 'expired' ? 'SESSION_EXPIRED' : 'AUTH_REQUIRED';
    return res.status(401).json({ error: code === 'SESSION_EXPIRED' ? 'Session expired.' : 'Authentication is required.', code });
  }
  req.auth = { user: result.user, rawUser: result.rawUser, session: result.session, sessionIdHash: sessionService.sessionIdHash(result.session) };
  return next();
};

export const createCsrfProtection = ({ sessionService, securityAudit = () => {} }) => (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookies = parseCookies(req.get('cookie'));
  const csrfToken = req.get('x-csrf-token');
  if (!req.auth || !csrfToken || csrfToken !== cookies.hico_csrf || !sessionService.validCsrf(req.auth.session, csrfToken)) {
    securityAudit({ event: 'csrf_failed', requestId: req.requestId, actorId: req.auth?.user.id });
    return res.status(403).json({ error: 'CSRF validation failed.', code: 'CSRF_INVALID' });
  }
  return next();
};

export const createAdminAuthorization = ({ securityReady = () => true, securityAudit = () => {} }) => (req, res, next) => {
  if (!securityReady() && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return res.status(503).json({ error: 'Admin writes are unavailable until security configuration is ready.', code: 'SECURITY_NOT_READY' });
  const permission = permissionForAdminRequest(req);
  if (!hasPermission(req.auth.user.permissions, permission)) {
    securityAudit({ event: 'auth_permission_denied', requestId: req.requestId, actorId: req.auth.user.id, permission });
    return res.status(403).json({ error: 'Permission denied.', code: 'PERMISSION_DENIED' });
  }
  req.auth.permissionUsed = permission;
  return next();
};
