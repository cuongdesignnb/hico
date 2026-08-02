export const createReferralHealthService = ({ referralService } = {}) => ({
  health: () => referralService?.health?.() ?? Promise.resolve({ status: 'disabled', enabled: false }),
});
