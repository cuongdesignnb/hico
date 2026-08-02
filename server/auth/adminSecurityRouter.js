import express from 'express';

export const createAdminSecurityRouter = ({ sessionService, securityAudit = () => {} } = {}) => {
  const router = express.Router();
  router.post('/sessions/:sessionId/revoke', async (req, res) => {
    await sessionService.revoke({ id: req.params.sessionId }, 'super_admin_revoke');
    securityAudit({ event: 'admin_session_revoked', actorId: req.auth.user.id, sessionIdHash: sessionService.sessionIdHash({ id: req.params.sessionId }) });
    return res.status(204).end();
  });
  router.post('/sessions/revoke-all', async (req, res) => {
    await sessionService.revokeEverySession('super_admin_global_revoke');
    securityAudit({ event: 'admin_sessions_revoked_all', actorId: req.auth.user.id });
    return res.status(204).end();
  });
  return router;
};
