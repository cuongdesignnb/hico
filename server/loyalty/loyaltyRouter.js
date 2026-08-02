import express from 'express';
import { parseCookies } from '../auth/authCookies.js';

const privateResponse = (res) => res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Expires: '0' });
const statusFor = { LOYALTY_DISABLED: 503, LOYALTY_NOT_READY: 503, CUSTOMER_AUTH_REQUIRED: 401, LOYALTY_ENTRY_NOT_FOUND: 404 };
const sendError = (res, error) => privateResponse(res).status(statusFor[error?.code] ?? 503).json({ error: error?.message ?? 'Loyalty is unavailable.', code: error?.code ?? 'LOYALTY_NOT_READY' });

export const createCustomerLoyaltyRouter = ({ customerAuthService, readiness, loyaltyService } = {}) => {
  const router = express.Router();
  const secure = async (req, res, next) => {
    if ((await readiness.evaluate()).status !== 'healthy') return sendError(res, Object.assign(new Error('Customer authentication is not ready.'), { code: 'LOYALTY_NOT_READY' }));
    try {
      const auth = await customerAuthService.authenticate(parseCookies(req.get('cookie')).hico_customer_session, req.requestId);
      if (auth.status !== 'active') return sendError(res, Object.assign(new Error('Customer authentication is required.'), { code: 'CUSTOMER_AUTH_REQUIRED' }));
      req.customerAuth = auth;
      return next();
    } catch { return sendError(res, Object.assign(new Error('Customer authentication is not ready.'), { code: 'LOYALTY_NOT_READY' })); }
  };
  router.get('/loyalty', secure, async (req, res) => {
    try { return privateResponse(res).json(await loyaltyService.summary(req.customerAuth.customer.id)); } catch (error) { return sendError(res, error); }
  });
  router.get('/loyalty/transactions', secure, async (req, res) => {
    try { return privateResponse(res).json(await loyaltyService.transactions(req.customerAuth.customer.id, req.query)); } catch (error) { return sendError(res, error); }
  });
  router.get('/loyalty/rules/public', async (_req, res) => {
    try { return res.set({ 'Cache-Control': 'public, max-age=300', Vary: 'Accept-Encoding' }).json(await loyaltyService.publicRules()); } catch (error) { return sendError(res, error); }
  });
  return router;
};
