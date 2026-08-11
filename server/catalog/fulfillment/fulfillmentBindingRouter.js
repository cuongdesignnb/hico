import express from 'express';

const actor = (req) => ({
  id: req.auth?.user?.id,
  email: req.auth?.user?.email,
  permission: req.auth?.permissionUsed,
});

const sendError = (res, error) => {
  if (error?.code && Number.isInteger(error.status)) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(`[catalog-fulfillment] ${error?.name ?? 'UnknownError'}`);
  return res.status(500).json({ error: 'Unable to process catalog fulfillment mapping.', code: 'FULFILLMENT_MAPPING_FAILED' });
};

export const createFulfillmentBindingRouter = ({ service } = {}) => {
  if (!service) throw new Error('Fulfillment binding service is required.');
  const router = express.Router();

  router.get('/catalog/fulfillment/preview', async (req, res) => {
    try { return res.json(await service.listPreview({ limit: req.query.limit })); } catch (error) { return sendError(res, error); }
  });

  router.get('/catalog/fulfillment/bindings', async (_req, res) => {
    try { return res.json(await service.listBindings()); } catch (error) { return sendError(res, error); }
  });

  router.post('/catalog/fulfillment/bindings', async (req, res) => {
    try {
      return res.status(201).json({ binding: await service.approveMapping({ ...req.body, actor: actor(req) }) });
    } catch (error) { return sendError(res, error); }
  });

  router.patch('/catalog/fulfillment/bindings/:id', async (req, res) => {
    try {
      return res.json({ binding: await service.changeMapping(req.params.id, req.body, actor(req)) });
    } catch (error) { return sendError(res, error); }
  });

  router.post('/catalog/fulfillment/bindings/:id/revoke', async (req, res) => {
    try { return res.json({ binding: await service.revokeMapping(req.params.id, req.body, actor(req)) }); } catch (error) { return sendError(res, error); }
  });

  return router;
};
