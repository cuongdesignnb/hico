import express from 'express';
import { esimSheetConfigStatus } from './esimSheetReferenceClient.js';
import { createEsimSheetAuditService } from './esimSheetAuditService.js';

const sendError = (res, error) => res.status(Number.isInteger(error?.status) ? error.status : 500).set('Cache-Control', 'no-store').json({
  error: error?.message ?? 'Không thể audit eSIM Sheet.',
  code: error?.code ?? 'ESIM_SHEET_AUDIT_FAILED',
  ...(error?.details ? { details: error.details } : {}),
});

export const createEsimSheetRouter = ({ env = process.env, auditService = createEsimSheetAuditService({ env }), syncService = null, connectionService = null } = {}) => {
  const router = express.Router();
  router.get('/admin/esim-sheet/config', async (_req, res) => {
    if (!connectionService?.getPublicSettings) return res.set('Cache-Control', 'no-store').json(esimSheetConfigStatus(env));
    try {
      const settings = await connectionService.getPublicSettings();
      const missing = [
        ...(!settings.credentialConfigured ? ['GOOGLE_SHEET_CREDENTIAL'] : []),
        ...(!settings.spreadsheetIdMasked ? ['ESIM_SHEET_ID'] : []),
        ...(settings.sheetName !== 'SimHICO' ? ['ESIM_SHEET_TAB'] : []),
        ...(!settings.range ? ['ESIM_SHEET_RANGE'] : []),
        ...(!settings.enabled ? ['GOOGLE_SHEET_ENABLED'] : []),
      ];
      return res.set('Cache-Control', 'no-store').json({ configured: missing.length === 0, missing, source: 'HICO_ESIM_SHEET', sheetTab: settings.sheetName, range: settings.range, credentialConfigured: settings.credentialConfigured });
    } catch (error) { return sendError(res, error); }
  });
  router.get('/admin/esim-sheet/audit', async (req, res) => {
    try {
      const mapping = req.query.mapping && typeof req.query.mapping === 'string'
        ? JSON.parse(req.query.mapping)
        : {};
      return res.set('Cache-Control', 'no-store').json(await auditService.audit({ mapping }));
    } catch (error) { return sendError(res, error); }
  });
  router.post('/admin/esim-sheet/preview', async (req, res) => {
    try {
      if (!syncService) return sendError(res, Object.assign(new Error('eSIM Sheet sync chưa sẵn sàng.'), { code: 'ESIM_SHEET_SYNC_UNAVAILABLE', status: 503 }));
      return res.set('Cache-Control', 'no-store').json(await syncService.preview(req.body, { id: req.auth?.user?.id ?? null }));
    } catch (error) { return sendError(res, error); }
  });
  router.post('/admin/esim-sheet/apply', async (req, res) => {
    try {
      if (!syncService) return sendError(res, Object.assign(new Error('eSIM Sheet sync chưa sẵn sàng.'), { code: 'ESIM_SHEET_SYNC_UNAVAILABLE', status: 503 }));
      const result = await syncService.apply(req.body, { id: req.auth?.user?.id ?? null });
      if (result.replayed) res.set('X-Idempotent-Replay', 'true');
      return res.status(result.status).json(result.body);
    } catch (error) { return sendError(res, error); }
  });
  return router;
};
