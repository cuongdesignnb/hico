import express from 'express';
import { parseCookies } from '../auth/authCookies.js';

const error = (res, value) => res.status(value?.code === 'ORDER_NOT_FOUND' ? 404 : 503).json({ error: value?.code === 'ORDER_NOT_FOUND' ? 'Order not found.' : 'Customer orders are unavailable.', code: value?.code ?? 'CUSTOMER_ORDERS_NOT_READY' });

export const createCustomerOrderRouter = ({ customerAuthService, sessionService, readiness, customerOrderService } = {}) => {
  const router = express.Router();
  const secure = async (req, res, next) => {
    if ((await readiness.evaluate()).status !== 'healthy') return error(res);
    try {
      const auth = await customerAuthService.authenticate(parseCookies(req.get('cookie')).hico_customer_session, req.requestId);
      if (auth.status !== 'active') return res.status(401).json({ error: 'Customer authentication is required.', code: 'CUSTOMER_AUTH_REQUIRED' });
      req.customerAuth = auth;
      return next();
    } catch { return error(res); }
  };
  const csrf = (req, res, next) => {
    const cookies = parseCookies(req.get('cookie'));
    const token = req.get('x-csrf-token');
    if (!token || token !== cookies.hico_customer_csrf || !sessionService.validCsrf(req.customerAuth.session, token)) return res.status(403).json({ error: 'CSRF validation failed.', code: 'CSRF_REQUIRED' });
    return next();
  };
  router.get('/orders', secure, async (req, res) => {
    try { return res.set('Cache-Control', 'no-store').json({ orders: await customerOrderService.list(req.customerAuth.customer.id, req.query) }); } catch (value) { return error(res, value); }
  });
  router.get('/orders/:orderId', secure, async (req, res) => {
    try { return res.set('Cache-Control', 'no-store').json({ order: await customerOrderService.get(req.customerAuth.customer.id, req.params.orderId) }); } catch (value) { return error(res, value); }
  });
  router.post('/orders/:orderId/claim/request', secure, csrf, async (req, res) => {
    try { await customerOrderService.requestClaim({ customer: req.customerAuth.customer, session: req.customerAuth.session, orderId: req.params.orderId, requestId: req.requestId }); } catch { /* generic response avoids enumeration */ }
    return res.status(202).json({ accepted: true });
  });
  router.post('/orders/:orderId/claim/confirm', secure, csrf, async (req, res) => {
    try { return res.json({ order: await customerOrderService.confirmClaim({ customer: req.customerAuth.customer, orderId: req.params.orderId, token: req.body?.token, requestId: req.requestId }) }); } catch (value) { return error(res, value); }
  });
  return router;
};
