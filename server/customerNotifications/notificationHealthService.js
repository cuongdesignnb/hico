export const createCustomerNotificationHealthService = ({ notificationService } = {}) => ({
  health() { return notificationService?.health?.() ?? Promise.resolve({ status: 'disabled', enabled: false, persistence: 'disabled' }); },
});
