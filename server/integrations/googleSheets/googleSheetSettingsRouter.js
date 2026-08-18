import express from 'express';
import { createRateLimiter } from '../../security/rateLimits.js';
import { GoogleSheetSettingsError } from './googleSheetSecretCrypto.js';

const actor = (req) => ({ id: req.auth?.user?.id, email: req.auth?.user?.email, permission: req.auth?.permissionUsed });
const privateResponse = (res) => res.set('Cache-Control', 'no-store');
const sendError = (res, error) => {
  if (error instanceof GoogleSheetSettingsError) return privateResponse(res).status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
  console.error(`[google-sheet-settings] ${error?.name ?? 'UnknownError'}`);
  return privateResponse(res).status(500).json({ error: 'Unable to process Google Sheet settings.', code: 'GOOGLE_SHEET_SETTINGS_FAILED' });
};

export const createGoogleSheetSettingsRouter = ({ settingsService, sheetSyncService, securityAudit = () => {}, rateLimit = createRateLimiter({ windowMs: 15 * 60_000, max: 10, key: (req) => `${req.auth?.user?.id ?? 'unknown'}:${req.ip ?? 'unknown'}`, audit: securityAudit }) } = {}) => {
  const router = express.Router();
  const path = '/settings/integrations/google-sheet';
  router.get(path, async (req, res) => { try { return privateResponse(res).json(await settingsService.getPublicSettings()); } catch (error) { return sendError(res, error); } });
  router.put(path, async (req, res) => {
    try { return privateResponse(res).json(await settingsService.saveSettings({ input: req.body ?? {}, expectedVersion: req.body?.version, actorId: actor(req).id, requestId: req.requestId })); }
    catch (error) { return sendError(res, error); }
  });
  router.put(`${path}/credential`, rateLimit, async (req, res) => {
    try {
      return privateResponse(res).json(await settingsService.replaceCredential({ input: req.body ?? {}, expectedVersion: req.body?.version, actorId: actor(req).id, requestId: req.requestId }));
    } catch (error) { return sendError(res, error); }
  });
  router.post(`${path}/test`, rateLimit, async (req, res) => {
    try { return privateResponse(res).json(await settingsService.testConnection({ input: req.body ?? {}, actorId: actor(req).id, requestId: req.requestId })); }
    catch (error) { return sendError(res, error); }
  });
  router.post(`${path}/discover`, rateLimit, async (req, res) => {
    try { return privateResponse(res).json(await settingsService.discoverSpreadsheet({ spreadsheetId: req.body?.spreadsheetId, actorId: actor(req).id, requestId: req.requestId })); }
    catch (error) { return sendError(res, error); }
  });
  router.post(`${path}/discover-header`, rateLimit, async (req, res) => {
    try { return privateResponse(res).json(await settingsService.discoverHeader({ ...req.body, actorId: actor(req).id, requestId: req.requestId })); }
    catch (error) { return sendError(res, error); }
  });
  router.post(`${path}/validate-range`, rateLimit, async (req, res) => {
    try { return privateResponse(res).json(await settingsService.validateRange(req.body ?? {})); }
    catch (error) { return sendError(res, error); }
  });
  router.delete(`${path}/credential`, rateLimit, async (req, res) => {
    try {
      return privateResponse(res).json(await settingsService.revokeCredential({ expectedVersion: req.body?.version, actorId: actor(req).id, requestId: req.requestId }));
    } catch (error) { return sendError(res, error); }
  });
  router.post(`${path}/preview`, async (req, res) => {
    try { return privateResponse(res).json(await sheetSyncService.preview({ actor: actor(req) })); }
    catch (error) { return sendError(res, error); }
  });
  return router;
};
