import express from 'express';
export const createFulfillmentRouter = () => {
  const router = express.Router();
  router.get('/user/orders', (_req, res) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', 'Thu, 31 Dec 2026 23:59:59 GMT');
    return res.status(410).json({ error: 'This endpoint is no longer available.', code: 'LEGACY_USER_API_DEPRECATED' });
  });
  return router;
};
