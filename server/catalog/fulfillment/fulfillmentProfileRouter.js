import express from 'express';

const actor = (req) => ({
  id: req.auth?.user?.id,
  email: req.auth?.user?.email,
  permission: req.auth?.permissionUsed,
});

const sendError = (res, error) => {
  if (error?.code && Number.isInteger(error.status)) return res.status(error.status).json({ error: error.message, code: error.code });
  console.error(`[catalog-fulfillment-profile] ${error?.name ?? 'UnknownError'}`);
  return res.status(500).json({ error: 'Unable to process fulfillment profile.', code: 'FULFILLMENT_PROFILE_FAILED' });
};

export const createFulfillmentProfileRouter = ({ service } = {}) => {
  if (!service) throw new Error('Fulfillment profile service is required.');
  const router = express.Router();
  router.get('/catalog/fulfillment/profiles', async (_req, res) => {
    try { return res.json(await service.list()); } catch (error) { return sendError(res, error); }
  });
  router.get('/catalog/fulfillment/profiles/preview', async (_req, res) => {
    try { return res.json(await service.preview()); } catch (error) { return sendError(res, error); }
  });
  router.post('/catalog/fulfillment/profiles', async (req, res) => {
    try { return res.status(201).json({ profile: await service.approve({ input: req.body, confirmed: req.body?.confirmed, actor: actor(req) }) }); } catch (error) { return sendError(res, error); }
  });
  router.patch('/catalog/fulfillment/profiles/:id', async (req, res) => {
    try { return res.json({ profile: await service.update(req.params.id, { input: req.body, confirmed: req.body?.confirmed, actor: actor(req) }) }); } catch (error) { return sendError(res, error); }
  });
  router.post('/catalog/fulfillment/profiles/:id/revoke', async (req, res) => {
    try { return res.json({ profile: await service.revoke(req.params.id, { version: req.body?.version, confirmed: req.body?.confirmed }, actor(req)) }); } catch (error) { return sendError(res, error); }
  });
  return router;
};
