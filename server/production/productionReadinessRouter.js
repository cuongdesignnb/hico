import express from 'express';

export const createProductionReadinessRouter = ({ readinessService } = {}) => {
  const router = express.Router();
  router.get('/health/production-readiness', async (_req, res) => {
    const readiness = await readinessService.evaluate({ force: true });
    return res.status(readiness.status === 'ready' ? 200 : 503).json(readiness.status === 'ready' ? readiness : {
      status: readiness.status,
      adminWritesAllowed: false,
      writesEnabled: false,
      criticalChecksPassed: readiness.criticalChecksPassed,
      criticalChecksTotal: readiness.criticalChecksTotal,
      error: 'Production readiness checks failed.',
      code: 'PRODUCTION_NOT_READY',
      failedChecks: readiness.failedChecks,
      checkedAt: readiness.checkedAt,
    });
  });
  return router;
};
