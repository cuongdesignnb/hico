import express from 'express';

const statusFor = { SUPPORT_NOT_READY: 503, SUPPORT_TICKET_NOT_FOUND: 404, SUPPORT_TICKET_CLOSED: 409, SUPPORT_ATTACHMENT_INVALID: 400, SUPPORT_ATTACHMENT_TOO_LARGE: 413, SUPPORT_ATTACHMENT_FORBIDDEN: 404 };
const sendError = (res, error) => res.status(statusFor[error?.code] ?? 503).json({ error: error?.message ?? 'Support administration is unavailable.', code: error?.code ?? 'SUPPORT_NOT_READY' });

export const createSupportAdminRouter = ({ supportService } = {}) => {
  const router = express.Router();
  router.get('/support/tickets', async (req, res) => { try { return res.set('Cache-Control', 'no-store').json(await supportService.adminList(req.query)); } catch (error) { return sendError(res, error); } });
  router.get('/support/tickets/attachments/:attachmentId', async (req, res) => { try { const file = await supportService.readAttachment(req.params.attachmentId); return res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': file.mimeType, 'Content-Disposition': `attachment; filename="${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}"` }).send(file.buffer); } catch (error) { return sendError(res, error); } });
  router.get('/support/tickets/:ticketId', async (req, res) => { try { return res.set('Cache-Control', 'no-store').json(await supportService.adminGet(req.params.ticketId)); } catch (error) { return sendError(res, error); } });
  router.post('/support/tickets/:ticketId/messages', async (req, res) => { try { return res.status(201).json(await supportService.adminMessage(req.params.ticketId, req.body?.body, req.auth.user.id, req.requestId)); } catch (error) { return sendError(res, error); } });
  router.post('/support/tickets/:ticketId/internal-notes', async (req, res) => { try { return res.status(201).json(await supportService.adminInternalMessage(req.params.ticketId, req.body?.body, req.auth.user.id, req.requestId)); } catch (error) { return sendError(res, error); } });
  router.post('/support/tickets/:ticketId/status', async (req, res) => { try { return res.json(await supportService.adminUpdate(req.params.ticketId, { status: req.body?.status, reason: req.body?.reason }, req.auth.user.id, req.requestId)); } catch (error) { return sendError(res, error); } });
  router.post('/support/tickets/:ticketId/assign', async (req, res) => { try { return res.json(await supportService.adminUpdate(req.params.ticketId, { assignedAdminId: req.body?.assignedAdminId, reason: req.body?.reason }, req.auth.user.id, req.requestId)); } catch (error) { return sendError(res, error); } });
  router.post('/support/tickets/:ticketId/attachments', async (req, res) => { try { return res.status(201).json({ attachment: await supportService.uploadAttachment({ ticketId: req.params.ticketId, adminId: req.auth.user.id, fileName: req.body?.fileName, mimeType: req.body?.mimeType, contentBase64: req.body?.contentBase64, requestId: req.requestId }) }); } catch (error) { return sendError(res, error); } });
  return router;
};
