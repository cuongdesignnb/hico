import express from 'express';
import { parseCookies } from '../auth/authCookies.js';

const unavailable = (res) => res.status(503).json({ error: 'Customer dashboard is unavailable.', code: 'CUSTOMER_DASHBOARD_NOT_READY' });
const notFound = (res) => res.status(404).json({ error: 'Order not found.', code: 'ORDER_NOT_FOUND' });

export const createCustomerDashboardRouter = ({ customerAuthService, readiness, customerDashboardService } = {}) => {
  const router = express.Router();
  const secure = async (req, res, next) => {
    if ((await readiness.evaluate()).status !== 'healthy') return unavailable(res);
    try {
      const auth = await customerAuthService.authenticate(parseCookies(req.get('cookie')).hico_customer_session, req.requestId);
      if (auth.status !== 'active') return res.status(401).json({ error: 'Customer authentication is required.', code: 'CUSTOMER_AUTH_REQUIRED' });
      req.customerAuth = auth;
      return next();
    } catch { return unavailable(res); }
  };
  const privateResponse = (res) => res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache' });
  router.get('/dashboard/summary', secure, async (req, res) => {
    try { return privateResponse(res).json(await customerDashboardService.summary(req.customerAuth.customer)); }
    catch { return unavailable(res); }
  });
  router.get('/orders', secure, async (req, res) => {
    try { return privateResponse(res).json(await customerDashboardService.list(req.customerAuth.customer.id, req.query)); }
    catch { return unavailable(res); }
  });
  router.get('/orders/:orderId', secure, async (req, res) => {
    try { return privateResponse(res).json({ order: await customerDashboardService.get(req.customerAuth.customer.id, req.params.orderId) }); }
    catch (value) { return value?.code === 'ORDER_NOT_FOUND' ? notFound(res) : unavailable(res); }
  });
  return router;
};
