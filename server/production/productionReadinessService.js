export const createProductionReadinessService = ({ checks, now = () => new Date(), cacheTtlMs = 15_000 } = {}) => {
  let cached = null;
  const evaluate = async ({ force = false } = {}) => {
    if (!force && cached && now().getTime() - Date.parse(cached.checkedAt) < cacheTtlMs) return cached;
    let result;
    try { result = await checks(); } catch { result = { production: true, failedChecks: ['READINESS_CHECK_ERROR'] }; }
    cached = {
      status: !result.production || result.failedChecks.length ? 'not_ready' : 'ready',
      adminWritesAllowed: Boolean(result.production && result.failedChecks.length === 0),
      writesEnabled: Boolean(result.production && result.failedChecks.length === 0),
      criticalChecksPassed: result.checks?.filter((check) => check.passed).length ?? 0,
      criticalChecksTotal: result.checks?.length ?? 0,
      failedChecks: result.failedChecks,
      checkedAt: now().toISOString(),
    };
    return cached;
  };
  return {
    evaluate,
    async assertWriteReady() {
      const readiness = await evaluate({ force: true });
      return readiness.adminWritesAllowed ? readiness : null;
    },
    invalidate() { cached = null; },
  };
};
