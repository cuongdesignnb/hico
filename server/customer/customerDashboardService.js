import { parseDashboardQuery, assertOrderId } from './customerDashboardValidation.js';
import { projectCustomerDashboardSummary, projectCustomerOrder } from './customerDashboardProjection.js';

const notFound = () => Object.assign(new Error('Order not found.'), { code: 'ORDER_NOT_FOUND' });

export const createCustomerDashboardService = ({ repository, env = process.env } = {}) => ({
  async summary(customer) {
    const query = { page: 1, pageSize: 5, sort: 'newest' };
    const [orders, aggregate] = await Promise.all([
      repository.listOwnedOrders(customer.id, query),
      repository.summarizeOwnedOrders(customer.id),
    ]);
    return projectCustomerDashboardSummary({
      customer,
      orders,
      aggregate,
      capabilities: {
        assets: env.CUSTOMER_ASSETS_AVAILABLE === 'true',
        loyalty: env.CUSTOMER_LOYALTY_AVAILABLE === 'true',
        notifications: env.CUSTOMER_NOTIFICATIONS_AVAILABLE === 'true',
        support: env.CUSTOMER_SUPPORT_AVAILABLE === 'true',
      },
    });
  },
  async list(customerId, rawQuery) {
    const query = parseDashboardQuery(rawQuery);
    const [items, totalItems] = await Promise.all([
      repository.listOwnedOrders(customerId, query),
      repository.countOwnedOrders(customerId, query),
    ]);
    return {
      items: items.map(projectCustomerOrder),
      pagination: { page: query.page, pageSize: query.pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)) },
    };
  },
  async get(customerId, orderId) {
    const order = await repository.getOwnedOrder(assertOrderId(orderId), customerId);
    if (!order) throw notFound();
    return projectCustomerOrder(order);
  },
  health() { return repository.health(); },
});
