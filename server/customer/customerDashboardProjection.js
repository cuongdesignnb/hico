const COMPLETED = new Set(['PROVISIONED', 'SHIPPED', 'COMPLETED']);
const CANCELLED = new Set(['CANCELLED']);
const PENDING = new Set(['PENDING', 'PROCESSING']);

const numberOrZero = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const maskEmail = (email = '') => {
  const [local, domain] = String(email).split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`;
};
const maskPhone = (phone) => {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits ? `${'*'.repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}` : null;
};
const itemsOf = (order) => Array.isArray(order?.items) ? order.items : [];

const safeItem = (item = {}) => ({
  productName: String(item.productName ?? item.name ?? 'Product'),
  productId: item.productId ?? null,
  variantId: item.variantId ?? null,
  sku: item.sku ?? null,
  operation: item.operation ?? null,
  quantity: Math.max(1, numberOrZero(item.quantity ?? 1)),
  unitPrice: numberOrZero(item.unitPrice ?? item.price),
  currency: String(item.currency ?? 'VND').toUpperCase(),
});

const currencyTotals = (order) => itemsOf(order).reduce((totals, item) => {
  const safe = safeItem(item);
  totals[safe.currency] = numberOrZero(totals[safe.currency]) + safe.unitPrice * safe.quantity;
  return totals;
}, {});

const fulfillmentSummary = (status) => ({
  status,
  pending: PENDING.has(status),
  completed: COMPLETED.has(status),
  cancelled: CANCELLED.has(status),
  sensitiveAssetsAvailable: false,
});

const maskedShipping = (shipping = {}) => {
  if (!shipping || typeof shipping !== 'object') return null;
  return {
    recipientName: shipping.recipientName ?? shipping.name ?? null,
    phone: maskPhone(shipping.phone),
    city: shipping.city ?? shipping.province ?? null,
  };
};

export const projectCustomerOrder = (order) => {
  if (!order) return null;
  const totalsByCurrency = currencyTotals(order);
  const status = String(order.status ?? 'PENDING').toUpperCase();
  return {
    orderId: order.orderId,
    createdAt: order.createdAt,
    status,
    currency: String(order.currency ?? Object.keys(totalsByCurrency)[0] ?? 'VND').toUpperCase(),
    subtotal: numberOrZero(order.subtotal ?? totalsByCurrency.VND),
    totalsByCurrency,
    items: itemsOf(order).map(safeItem),
    shipping: maskedShipping(order.shipping ?? order.shippingAddress),
    fulfillment: fulfillmentSummary(status),
    nextAction: PENDING.has(status) ? 'WAIT_FOR_FULFILLMENT' : 'NONE',
  };
};

export const projectCustomerDashboardSummary = ({ customer, orders, totalItems, aggregate, capabilities = {}, assetSummary } = {}) => {
  const projected = (orders ?? []).map(projectCustomerOrder);
  const counts = projected.reduce((result, order) => {
    result.total += 1;
    if (PENDING.has(order.status)) result.pending += 1;
    if (COMPLETED.has(order.status)) result.completed += 1;
    if (CANCELLED.has(order.status)) result.cancelled += 1;
    Object.entries(order.totalsByCurrency).forEach(([currency, amount]) => { result.totalsByCurrency[currency] = numberOrZero(result.totalsByCurrency[currency]) + amount; });
    return result;
  }, { total: 0, pending: 0, completed: 0, cancelled: 0, totalsByCurrency: {} });
  const overall = aggregate ?? { total: totalItems ?? counts.total, pending: counts.pending, completed: counts.completed, cancelled: counts.cancelled, pendingItems: projected.filter((order) => order.fulfillment.pending).reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0), totalsByCurrency: counts.totalsByCurrency };
  return {
    customer: { displayName: customer?.displayName ?? '', email: maskEmail(customer?.email), phone: maskPhone(customer?.phone) },
    orders: { total: Number(overall.total), pending: Number(overall.pending), completed: Number(overall.completed), cancelled: Number(overall.cancelled), totalsByCurrency: overall.totalsByCurrency },
    fulfillment: { pendingOrders: Number(overall.pending), pendingItems: Number(overall.pendingItems ?? 0) },
    recentOrders: projected.slice(0, 5),
    capabilities: { assets: false, loyalty: false, notifications: false, support: false, ...capabilities },
    assetSummary: assetSummary ?? { available: false },
    generatedAt: new Date().toISOString(),
  };
};
