export const createSessionCleanupService = ({ sessionRepository, env = process.env, logger = console, now = () => new Date() } = {}) => {
  const intervalMs = Math.max(60_000, Number.parseInt(env.SESSION_CLEANUP_INTERVAL_MS, 10) || 3_600_000);
  const batchSize = Math.max(1, Number.parseInt(env.SESSION_CLEANUP_BATCH_SIZE, 10) || 500);
  const revokedRetentionHours = Math.max(1, Number.parseInt(env.SESSION_REVOKED_RETENTION_HOURS, 10) || 720);
  let lastRunAt = null;
  let running = false;
  const run = async ({ force = false } = {}) => {
    if (!sessionRepository.cleanup) return { status: 'unsupported', deleted: 0, checkedAt: now().toISOString() };
    if (running) return { status: 'running', deleted: 0, checkedAt: now().toISOString() };
    if (!force && lastRunAt && now().getTime() - Date.parse(lastRunAt) < intervalMs) return { status: 'skipped', deleted: 0, checkedAt: now().toISOString() };
    running = true;
    try {
      const deleted = await sessionRepository.cleanup({ batchSize, revokedRetentionHours });
      lastRunAt = now().toISOString();
      logger.info?.(JSON.stringify({ event: 'session_cleanup', deleted, checkedAt: lastRunAt }));
      return { status: 'completed', deleted, checkedAt: lastRunAt };
    } catch {
      lastRunAt = now().toISOString();
      logger.error?.({ event: 'session_cleanup_failed', checkedAt: lastRunAt });
      return { status: 'failed', deleted: 0, checkedAt: lastRunAt };
    } finally { running = false; }
  };
  return { run, getStatus: () => ({ lastRunAt, running, intervalMs, batchSize }) };
};
