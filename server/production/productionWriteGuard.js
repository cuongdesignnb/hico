export const createProductionWriteGuard = ({ readinessService, env = process.env, allowWhenNotReady = () => false } = {}) => async (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (env.NODE_ENV !== 'production') return next();
  if (allowWhenNotReady(req)) return next();
  const readiness = await readinessService.assertWriteReady();
  if (readiness) return next();
  return res.status(503).json({
    status: 'not_ready',
    adminWritesAllowed: false,
    error: 'Production readiness checks failed.',
    code: 'PRODUCTION_NOT_READY',
    failedChecks: (await readinessService.evaluate()).failedChecks,
  });
};
