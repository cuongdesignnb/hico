import express from 'express';
import { parseCookies } from '../auth/authCookies.js';

const writes = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const statusFor = {
  PROFILE_NOT_FOUND: 404, PROFILE_UPDATE_INVALID: 400, CONTACT_CHANGE_NOT_READY: 503,
  CONTACT_CHANGE_TOKEN_INVALID: 400, CONTACT_CHANGE_TOKEN_EXPIRED: 410, CONTACT_ALREADY_IN_USE: 409,
  ADDRESS_NOT_FOUND: 404, ADDRESS_LIMIT_REACHED: 409, ADDRESS_VALIDATION_FAILED: 400,
  PASSWORD_CHANGE_FAILED: 400, CUSTOMER_AUTH_REQUIRED: 401, CSRF_REQUIRED: 403,
  PROFILE_NOT_READY: 503,
};
const privateResponse = (res) => res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Expires: '0' });
const sendError = (res, error) => privateResponse(res).status(statusFor[error?.code] ?? 503).json({ error: error?.message ?? 'Customer profile is unavailable.', code: error?.code ?? 'PROFILE_NOT_READY' });

export const createCustomerProfileRouter = ({ customerAuthService, customerSessionService, readiness, profileService, securityAudit = () => {} } = {}) => {
  const router = express.Router();
  const secure = async (req, res, next) => {
    try {
      if ((await readiness.evaluate()).status !== 'healthy' || !profileService.enabled) return sendError(res, Object.assign(new Error('Customer profile is unavailable.'), { code: 'PROFILE_NOT_READY' }));
      const auth = await customerAuthService.authenticate(parseCookies(req.get('cookie')).hico_customer_session, req.requestId);
      if (auth.status !== 'active') return sendError(res, Object.assign(new Error('Customer authentication is required.'), { code: 'CUSTOMER_AUTH_REQUIRED' }));
      req.customerAuth = auth;
      return next();
    } catch { return sendError(res); }
  };
  const csrf = (req, res, next) => {
    if (!writes.has(req.method)) return next();
    const token = req.get('x-csrf-token');
    const cookies = parseCookies(req.get('cookie'));
    if (!token || token !== cookies.hico_customer_csrf || !customerSessionService.validCsrf(req.customerAuth.session, token)) {
      securityAudit({ event: 'customer_csrf_failed', requestId: req.requestId, actorId: req.customerAuth?.customer.id });
      return sendError(res, Object.assign(new Error('CSRF validation failed.'), { code: 'CSRF_REQUIRED' }));
    }
    return next();
  };
  const publicReady = async (_req, res, next) => {
    if (!profileService.enabled) return sendError(res, Object.assign(new Error('Customer profile is unavailable.'), { code: 'PROFILE_NOT_READY' }));
    if ((await readiness.evaluate()).status !== 'healthy') return sendError(res, Object.assign(new Error('Customer profile is unavailable.'), { code: 'PROFILE_NOT_READY' }));
    return next();
  };

  router.get('/profile', secure, async (req, res) => { try { return privateResponse(res).json({ profile: await profileService.get(req.customerAuth.customer.id) }); } catch (error) { return sendError(res, error); } });
  router.put('/profile', secure, csrf, async (req, res) => {
    try {
      const allowed = new Set(['displayName', 'locale', 'timezone', 'avatarUrl']);
      if (Object.keys(req.body ?? {}).some((key) => !allowed.has(key))) throw Object.assign(new Error('Profile update contains protected fields.'), { code: 'PROFILE_UPDATE_INVALID' });
      return privateResponse(res).json({ profile: await profileService.update(req.customerAuth.customer.id, req.body ?? {}, req.requestId) });
    } catch (error) { return sendError(res, error); }
  });
  for (const type of ['email', 'phone']) {
    router.post(`/profile/${type}/change/request`, secure, csrf, async (req, res) => {
      try { return privateResponse(res).status(202).json(await profileService.requestContactChange({ customerId: req.customerAuth.customer.id, contactType: type, value: req.body?.value, requestId: req.requestId })); } catch (error) { return sendError(res, error); }
    });
    router.post(`/profile/${type}/change/confirm`, publicReady, async (req, res) => {
      try { return privateResponse(res).json(await profileService.confirmContactChange({ token: req.body?.token ?? req.query?.token, requestId: req.requestId })); } catch (error) { return sendError(res, error); }
    });
  }
  router.get('/addresses', secure, async (req, res) => { try { return privateResponse(res).json({ addresses: await profileService.listAddresses(req.customerAuth.customer.id) }); } catch (error) { return sendError(res, error); } });
  router.post('/addresses', secure, csrf, async (req, res) => { try { return privateResponse(res).status(201).json({ address: await profileService.createAddress(req.customerAuth.customer.id, req.body) }); } catch (error) { return sendError(res, error); } });
  router.put('/addresses/:addressId', secure, csrf, async (req, res) => { try { return privateResponse(res).json({ address: await profileService.updateAddress(req.customerAuth.customer.id, req.params.addressId, req.body) }); } catch (error) { return sendError(res, error); } });
  router.delete('/addresses/:addressId', secure, csrf, async (req, res) => { try { await profileService.deleteAddress(req.customerAuth.customer.id, req.params.addressId); return privateResponse(res).status(204).end(); } catch (error) { return sendError(res, error); } });
  router.post('/addresses/:addressId/default', secure, csrf, async (req, res) => { try { return privateResponse(res).json({ address: await profileService.setDefaultAddress(req.customerAuth.customer.id, req.params.addressId) }); } catch (error) { return sendError(res, error); } });
  router.post('/security/password/change', secure, csrf, async (req, res) => {
    try {
      const result = await customerAuthService.changePassword({ session: req.customerAuth.session, customerId: req.customerAuth.customer.id, currentPassword: req.body?.currentPassword, newPassword: req.body?.newPassword, requestId: req.requestId });
      await profileService.recordSecurityEvent({ customerId: req.customerAuth.customer.id, eventType: 'SECURITY_PASSWORD_CHANGED', notificationType: 'SECURITY_PASSWORD_CHANGED', requestId: req.requestId });
      return privateResponse(res).json({ changed: true, changedAt: result.changedAt });
    } catch (error) { return sendError(res, error); }
  });
  router.get('/security/events', secure, async (req, res) => { try { return privateResponse(res).json(await profileService.listSecurityEvents(req.customerAuth.customer.id, req.query)); } catch (error) { return sendError(res, error); } });
  return router;
};
