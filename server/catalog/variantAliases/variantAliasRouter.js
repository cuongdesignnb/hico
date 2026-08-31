import express from 'express';
import { createVariantAliasService } from './variantAliasService.js';

const actor = (req) => ({ id: req.auth?.user?.id, email: req.auth?.user?.email, permission: req.auth?.permissionUsed });
const sendError = (res, error) => {
  if (error?.code && Number.isInteger(error.status)) return res.status(error.status).json({ error: error.message, code: error.code });
  console.error(`[catalog-variant-alias] ${error?.name ?? 'UnknownError'}`);
  return res.status(500).json({ error: 'Unable to process catalog variant identity reconciliation.', code: 'RECONCILIATION_FAILED' });
};

export const createVariantAliasRouter = ({ service = createVariantAliasService() } = {}) => {
  const router = express.Router();
  router.get('/catalog/sheet-reconciliation/unmatched', async (req, res) => { try { res.json({ items: await service.listUnmatched({ limit: Math.min(Number(req.query.limit) || 100, 500) }) }); } catch (error) { sendError(res, error); } });
  router.get('/catalog/sheet-reconciliation/:candidateId/candidates', async (req, res) => { try { res.json(await service.candidates(req.params.candidateId)); } catch (error) { sendError(res, error); } });
  router.post('/catalog/variant-aliases', async (req, res) => { try { res.status(201).json({ alias: await service.create(req.body, actor(req)) }); } catch (error) { sendError(res, error); } });
  router.patch('/catalog/variant-aliases/:id', async (req, res) => { try { res.json({ alias: await service.update(req.params.id, req.body, actor(req)) }); } catch (error) { sendError(res, error); } });
  router.post('/catalog/variant-aliases/:id/revoke', async (req, res) => { try { res.json({ alias: await service.revoke(req.params.id, req.body, actor(req)) }); } catch (error) { sendError(res, error); } });
  return router;
};
