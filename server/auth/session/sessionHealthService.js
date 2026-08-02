export const createSessionHealthService = ({ sessionRepository, driver, shared, cleanupService, now = () => new Date() } = {}) => ({
  async getHealth() {
    const repositoryHealth = await (sessionRepository.health?.() ?? { status: 'healthy', shared });
    return {
      status: repositoryHealth.status,
      driver,
      shared,
      multiInstanceReady: Boolean(shared && repositoryHealth.status === 'healthy'),
      lastCheckedAt: now().toISOString(),
      cleanup: cleanupService?.getStatus?.(),
    };
  },
});
