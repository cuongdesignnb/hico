const statuses = new Set(['PENDING', 'PROCESSING', 'PROVISIONED', 'SHIPPED', 'COMPLETED', 'CANCELLED']);
const operations = new Set(['esim', 'topup', 'device_sale', 'physical_sim']);

const integer = (value, fallback, maximum) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, parsed));
};

export const parseDashboardQuery = (query = {}) => ({
  status: statuses.has(String(query.status ?? '').toUpperCase()) ? String(query.status).toUpperCase() : undefined,
  operation: operations.has(String(query.operation ?? '')) ? String(query.operation) : undefined,
  from: typeof query.from === 'string' && !Number.isNaN(Date.parse(query.from)) ? query.from : undefined,
  to: typeof query.to === 'string' && !Number.isNaN(Date.parse(query.to)) ? query.to : undefined,
  sort: query.sort === 'oldest' ? 'oldest' : 'newest',
  page: integer(query.page, 1, 10_000),
  pageSize: integer(query.pageSize, 20, 50),
});

export const assertOrderId = (orderId) => {
  if (typeof orderId !== 'string' || orderId.length < 1 || orderId.length > 100) {
    const error = new Error('Invalid order id.');
    error.code = 'ORDER_NOT_FOUND';
    throw error;
  }
  return orderId;
};
