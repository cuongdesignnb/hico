import express from 'express';

const errorStatus = { LOYALTY_ADJUSTMENT_INVALID: 400, LOYALTY_IDEMPOTENCY_CONFLICT: 409, LOYALTY_NOT_READY: 503, LOYALTY_DISABLED: 503 };
export const createLoyaltyAdminRouter = ({ loyaltyService } = {}) => {
  const router = express.Router();
  router.post('/customers/:customerId/loyalty/adjust', async (req, res) => {
    try {
      const idempotencyKey = String(req.get('Idempotency-Key') ?? req.body?.idempotencyKey ?? '').trim();
      if (!idempotencyKey || idempotencyKey.length > 160) return res.status(400).json({ error: 'Idempotency-Key is required.', code: 'LOYALTY_ADJUSTMENT_INVALID' });
      const result = await loyaltyService.adminAdjust({
        customerId: req.params.customerId,
        points: req.body?.points,
        reason: req.body?.reason,
        idempotencyKey,
        actorId: req.auth.user.id,
      });
      return res.status(result.idempotent ? 200 : 201).set({ 'Cache-Control': 'no-store' }).json(result);
    } catch (error) { return res.status(errorStatus[error?.code] ?? 503).json({ error: error?.message ?? 'Loyalty adjustment failed.', code: error?.code ?? 'LOYALTY_NOT_READY' }); }
  });
  return router;
};
