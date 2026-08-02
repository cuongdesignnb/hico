import express from 'express';
import { parseCookies } from '../auth/authCookies.js';

const writes = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const privateResponse = (res) => res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Expires: '0' });
const statusFor = { NOTIFICATIONS_NOT_READY: 503, NOTIFICATION_NOT_OWNED: 404, INVALID_NOTIFICATION_FILTER: 400, CUSTOMER_AUTH_REQUIRED: 401, CSRF_REQUIRED: 403 };
const sendError = (res, error) => privateResponse(res).status(statusFor[error?.code] ?? 503).json({ error: error?.message ?? 'Customer notifications are unavailable.', code: error?.code ?? 'NOTIFICATIONS_NOT_READY' });

export const createCustomerNotificationRouter = ({ customerAuthService, sessionService, readiness, notificationService, securityAudit = () => {} } = {}) => {
  const router = express.Router();
  const secure = async (req, res, next) => {
    if ((await readiness.evaluate()).status !== 'healthy') return sendError(res, Object.assign(new Error('Customer notifications are not ready.'), { code: 'NOTIFICATIONS_NOT_READY' }));
    try {
      const auth = await customerAuthService.authenticate(parseCookies(req.get('cookie')).hico_customer_session, req.requestId);
      if (auth.status !== 'active') return sendError(res, Object.assign(new Error('Customer authentication is required.'), { code: 'CUSTOMER_AUTH_REQUIRED' }));
      req.customerAuth = auth;
      return next();
    } catch { return sendError(res, Object.assign(new Error('Customer notifications are not ready.'), { code: 'NOTIFICATIONS_NOT_READY' })); }
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
  router.get('/notifications', secure, async (req, res) => { try { return privateResponse(res).json(await notificationService.list(req.customerAuth.customer.id, req.query)); } catch (error) { return sendError(res, error); } });
  router.get('/notifications/unread-count', secure, async (req, res) => { try { return privateResponse(res).json(await notificationService.unreadCount(req.customerAuth.customer.id)); } catch (error) { return sendError(res, error); } });
  router.post('/notifications/:notificationId/read', secure, csrf, async (req, res) => { try { return privateResponse(res).json(await notificationService.markRead(req.params.notificationId, req.customerAuth.customer.id)); } catch (error) { return sendError(res, error); } });
  router.post('/notifications/read-all', secure, csrf, async (req, res) => { try { return privateResponse(res).json(await notificationService.readAll(req.customerAuth.customer.id)); } catch (error) { return sendError(res, error); } });
  return router;
};
