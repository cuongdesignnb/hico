import express from 'express';
import { parseCookies } from '../auth/authCookies.js';

const writes = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const statuses = { SUPPORT_NOT_READY: 503, SUPPORT_TICKET_NOT_FOUND: 404, SUPPORT_TICKET_CLOSED: 409, SUPPORT_ATTACHMENT_INVALID: 400, SUPPORT_ATTACHMENT_TOO_LARGE: 413, SUPPORT_ATTACHMENT_FORBIDDEN: 404, CUSTOMER_AUTH_REQUIRED: 401, CSRF_REQUIRED: 403 };
const privateResponse = (res) => res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Expires: '0' });
const sendError = (res, error) => privateResponse(res).status(statuses[error?.code] ?? 503).json({ error: error?.message ?? 'Customer support is unavailable.', code: error?.code ?? 'SUPPORT_NOT_READY' });

export const createSupportRouter = ({ customerAuthService, customerSessionService, readiness, supportService, securityAudit = () => {} } = {}) => {
  const router = express.Router();
  const secure = async (req, res, next) => {
    try {
      if ((await readiness.evaluate()).status !== 'healthy' || !supportService.enabled) return sendError(res, Object.assign(new Error('Customer support is unavailable.'), { code: 'SUPPORT_NOT_READY' }));
      const auth = await customerAuthService.authenticate(parseCookies(req.get('cookie')).hico_customer_session, req.requestId);
      if (auth.status !== 'active') return sendError(res, Object.assign(new Error('Customer authentication is required.'), { code: 'CUSTOMER_AUTH_REQUIRED' }));
      req.customerAuth = auth; return next();
    } catch { return sendError(res); }
  };
  const csrf = (req, res, next) => {
    if (!writes.has(req.method)) return next();
    const token = req.get('x-csrf-token'); const cookies = parseCookies(req.get('cookie'));
    if (!token || token !== cookies.hico_customer_csrf || !customerSessionService.validCsrf(req.customerAuth.session, token)) { securityAudit({ event: 'customer_csrf_failed', requestId: req.requestId, actorId: req.customerAuth?.customer.id }); return sendError(res, Object.assign(new Error('CSRF validation failed.'), { code: 'CSRF_REQUIRED' })); }
    return next();
  };
  router.get('/tickets', secure, async (req, res) => { try { return privateResponse(res).json(await supportService.customerList(req.customerAuth.customer.id, req.query)); } catch (error) { return sendError(res, error); } });
  router.post('/tickets', secure, csrf, async (req, res) => { try { return privateResponse(res).status(201).json(await supportService.createCustomerTicket(req.customerAuth.customer.id, req.body ?? {}, req.requestId)); } catch (error) { return sendError(res, error); } });
  router.get('/tickets/attachments/:attachmentId', secure, async (req, res) => {
    try { const file = await supportService.readAttachment(req.params.attachmentId, { customerId: req.customerAuth.customer.id }); return res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': file.mimeType, 'Content-Disposition': `attachment; filename="${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}"` }).send(file.buffer); } catch (error) { return sendError(res, error); }
  });
  router.get('/tickets/:ticketId', secure, async (req, res) => { try { return privateResponse(res).json(await supportService.customerGet(req.customerAuth.customer.id, req.params.ticketId)); } catch (error) { return sendError(res, error); } });
  router.post('/tickets/:ticketId/messages', secure, csrf, async (req, res) => { try { return privateResponse(res).status(201).json(await supportService.addCustomerMessage(req.customerAuth.customer.id, req.params.ticketId, req.body?.body, req.requestId)); } catch (error) { return sendError(res, error); } });
  router.post('/tickets/:ticketId/close', secure, csrf, async (req, res) => { try { return privateResponse(res).json(await supportService.closeCustomerTicket(req.customerAuth.customer.id, req.params.ticketId, req.requestId)); } catch (error) { return sendError(res, error); } });
  router.post('/tickets/:ticketId/attachments', secure, csrf, async (req, res) => { try { return privateResponse(res).status(201).json({ attachment: await supportService.uploadAttachment({ ticketId: req.params.ticketId, customerId: req.customerAuth.customer.id, fileName: req.body?.fileName, mimeType: req.body?.mimeType, contentBase64: req.body?.contentBase64, requestId: req.requestId }) }); } catch (error) { return sendError(res, error); } });
  return router;
};
