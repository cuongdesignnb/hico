import { parseDashboardQuery, assertOrderId } from './customerDashboardValidation.js';
import { projectCustomerDashboardSummary, projectCustomerOrder } from './customerDashboardProjection.js';

const notFound = () => Object.assign(new Error('Order not found.'), { code: 'ORDER_NOT_FOUND' });

export const createCustomerDashboardService = ({ repository, env = process.env, assetSummaryService = null, loyaltyService = null } = {}) => {
  let assets = assetSummaryService;
  let loyalty = loyaltyService;
  return {
  setAssetSummaryService(service) { assets = service; },
  setLoyaltyService(service) { loyalty = service; },
  async summary(customer) {
    const query = { page: 1, pageSize: 5, sort: 'newest' };
    const [orders, aggregate] = await Promise.all([
      repository.listOwnedOrders(customer.id, query),
      repository.summarizeOwnedOrders(customer.id),
    ]);
    const assetSummary = assets ? await assets.summary(customer.id) : { esims: { total: 0, active: 0, pending: 0 }, physicalSims: { total: 0, pendingShip: 0, shipped: 0 }, devices: { total: 0 }, topups: { total: 0, pending: 0, completed: 0 }, available: { esims: false, physicalSims: false, devices: false, topups: false } };
    const loyaltySummary = loyalty ? await loyalty.dashboardSummary(customer.id) : { available: false };
    return projectCustomerDashboardSummary({
      customer,
      orders,
      aggregate,
      capabilities: {
        assets: Object.values(assetSummary.available).some(Boolean),
        loyalty: loyaltySummary.available,
        notifications: env.CUSTOMER_NOTIFICATIONS_AVAILABLE === 'true',
        support: env.CUSTOMER_SUPPORT_AVAILABLE === 'true',
      },
      assetSummary,
      loyaltySummary,
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
  };
};
