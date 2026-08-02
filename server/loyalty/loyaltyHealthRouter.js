export const createLoyaltyHealthRouter = ({ loyaltyService } = {}) => async (_req, res) => {
  const health = await loyaltyService.health();
  return res.status(health.status === 'healthy' || health.status === 'disabled' ? 200 : 503).json(health);
};
