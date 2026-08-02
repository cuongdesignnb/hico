export const createCustomerDashboardRepository = ({ orderRepository } = {}) => ({
  listOwnedOrders(customerId, query) {
    return orderRepository.listForCustomer(customerId, query);
  },
  countOwnedOrders(customerId, query) {
    return orderRepository.countForCustomer(customerId, query);
  },
  summarizeOwnedOrders(customerId) {
    return orderRepository.summaryForCustomer(customerId);
  },
  getOwnedOrder(orderId, customerId) {
    return orderRepository.getForCustomer(orderId, customerId);
  },
  health() {
    return orderRepository.health();
  },
});
