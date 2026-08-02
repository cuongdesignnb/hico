export const ORDER_STATUSES = new Set([
  'PROVISIONED',
  'SHIPPED',
  'PENDING_SHIP',
  'PENDING_QR_ASSIGN',
  'PENDING_CALLBACK',
  'CANCELLED',
]);

export const normalizeOrder = (order) => ({
  ...order,
  items: Array.isArray(order?.items) ? order.items : [],
  fulfillmentRecordIds: Array.isArray(order?.fulfillmentRecordIds)
    ? order.fulfillmentRecordIds
    : [],
  checkoutEngine: order?.checkoutEngine === 'canonical' ? 'canonical' : 'legacy',
  fulfillmentVersion: order?.fulfillmentVersion ?? 0,
});

export const assertOrderStatus = (status) => {
  if (!ORDER_STATUSES.has(status)) throw new Error(`Unsupported order status: ${status}`);
  return status;
};

export const projectOrderForDashboard = (order) => {
  const normalized = normalizeOrder(order);
  return {
    ...normalized,
    items: normalized.items.map((item) => ({
      ...item,
      productName: item.productName,
      redemptionCode: item.redemptionCode ?? item.rcode,
      qrcode: item.qrcode,
      qrcodeContent: item.qrcodeContent,
      pin1: item.pin1,
      puk1: item.puk1,
      apnExplain: item.apnExplain,
    })),
  };
};
