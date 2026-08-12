import express from 'express';
import { verifyPassword } from '../../auth/passwordService.js';
import { SePaySettingsError } from './sepayErrors.js';

const privateResponse = (res) => res.set('Cache-Control', 'no-store');
const actor = (req) => ({ id: req.auth?.user?.id, email: req.auth?.user?.email });
const sendError = (res, error) => {
  if (error?.status && error?.code) return privateResponse(res).status(error.status).json({ error: error.message, code: error.code });
  console.error(`[sepay] ${error?.name ?? 'UnknownError'}`);
  return privateResponse(res).status(500).json({ error: 'Không thể xử lý cài đặt SePay.', code: 'SEPAY_SETTINGS_FAILED' });
};

const reauth = async (req) => {
  const password = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!password || !req.auth?.rawUser?.passwordHash || !await verifyPassword(password, req.auth.rawUser.passwordHash)) throw new SePaySettingsError('Cần xác thực lại Admin gần đây.', { code: 'ADMIN_REAUTH_FAILED', status: 403 });
};

export const createSePayAdminRouter = ({ settingsService, paymentRepository } = {}) => {
  const router = express.Router();
  router.get('/payments/settings', async (_req, res) => {
    try { return privateResponse(res).json(await settingsService.getPublicSettings()); } catch (error) { return sendError(res, error); }
  });
  router.put('/payments/settings', async (req, res) => {
    try { return privateResponse(res).json(await settingsService.saveSettings({ input: req.body ?? {}, expectedVersion: req.body?.version, actorId: actor(req).id, requestId: req.requestId })); } catch (error) { return sendError(res, error); }
  });
  router.put('/payments/settings/credential', async (req, res) => {
    try { await reauth(req); return privateResponse(res).json(await settingsService.replaceCredential({ input: req.body ?? {}, expectedVersion: req.body?.version, actorId: actor(req).id, requestId: req.requestId })); } catch (error) { return sendError(res, error); }
  });
  router.get('/payments/transactions', async (req, res) => {
    try { return privateResponse(res).json(await paymentRepository.listTransactions({ page: req.query.page, pageSize: req.query.pageSize })); } catch (error) { return sendError(res, error); }
  });
  return router;
};

export const createSePayWebhookRouter = ({ webhookService } = {}) => {
  const router = express.Router();
  router.post('/', async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : null;
      if (!rawBody) throw new SePaySettingsError('SePay webhook yêu cầu raw JSON body.', { code: 'SEPAY_RAW_BODY_REQUIRED', status: 400 });
      const result = await webhookService.handle({ rawBody, signature: req.get('X-SePay-Signature'), timestamp: req.get('X-SePay-Timestamp') });
      return res.status(200).json(result);
    } catch (error) {
      if (error?.status && error?.code) return res.status(error.status).json({ error: error.message, code: error.code });
      console.error(`[sepay-webhook] ${error?.name ?? 'UnknownError'}`);
      return res.status(500).json({ error: 'Unable to process SePay webhook.', code: 'SEPAY_WEBHOOK_FAILED' });
    }
  });
  return router;
};
