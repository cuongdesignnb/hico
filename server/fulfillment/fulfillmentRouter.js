import express from 'express';
export const createFulfillmentRouter = () => {
  const router = express.Router();
  router.get('/user/orders', (_req, res) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', 'Thu, 31 Dec 2026 23:59:59 GMT');
    return res.status(410).json({ error: 'API cũ đã ngừng hỗ trợ.', code: 'LEGACY_CUSTOMER_API_DISABLED' });
  });
  return router;
};
