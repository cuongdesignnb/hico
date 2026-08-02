import express from 'express';

const statusFor = { REFERRAL_NOT_READY: 503, REFERRAL_NOT_ELIGIBLE: 404, REFERRAL_CODE_INVALID: 400 };
const sendError = (res, error) => res.status(statusFor[error?.code] ?? 503).json({ error: error?.message ?? 'Referral review failed.', code: error?.code ?? 'REFERRAL_NOT_READY' });

export const createReferralAdminRouter = ({ referralService } = {}) => {
  const router = express.Router();
  router.get('/referrals', async (req, res) => {
    try { return res.set('Cache-Control', 'no-store').json(await referralService.adminList(req.query)); } catch (error) { return sendError(res, error); }
  });
  router.get('/referrals/:relationshipId', async (req, res) => {
    try {
      const result = await referralService.adminList({ relationshipId: req.params.relationshipId, page: 1, pageSize: 1 });
      if (!result.items.length) return res.status(404).json({ error: 'Referral relationship was not found.', code: 'REFERRAL_NOT_ELIGIBLE' });
      return res.set('Cache-Control', 'no-store').json(result.items[0]);
    } catch (error) { return sendError(res, error); }
  });
  router.post('/referrals/:relationshipId/review', async (req, res) => {
    try {
      const result = await referralService.adminDecision({ relationshipId: req.params.relationshipId, status: 'MANUAL_REVIEW', reason: req.body?.reason, actorId: req.auth.user.id, requestId: req.requestId });
      return res.set('Cache-Control', 'no-store').json(result);
    } catch (error) { return sendError(res, error); }
  });
  router.post('/referrals/:relationshipId/reject', async (req, res) => {
    try {
      const result = await referralService.adminDecision({ relationshipId: req.params.relationshipId, status: 'REJECTED', reason: req.body?.reason, actorId: req.auth.user.id, requestId: req.requestId });
      return res.set('Cache-Control', 'no-store').json(result);
    } catch (error) { return sendError(res, error); }
  });
  return router;
};
