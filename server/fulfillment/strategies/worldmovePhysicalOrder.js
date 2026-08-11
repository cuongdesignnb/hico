import { result, safeProviderFields } from '../strategyUtils.js';

export const createWorldmovePhysicalOrderStrategy = () => ({
  async execute({ order, item, itemId, providerClient }) {
    const response = await providerClient.createPhysicalOrder({
      email: order.email,
      wmproductId: item.providerWmproductId ?? item.wmproductId,
      quantity: item.quantity,
      shipping: order.shippingAddress,
      idempotencyKey: `${order.orderId}:${itemId}:CREATE_PHYSICAL`,
    });
    return result('PENDING_SHIP', { providerReference: response.orderId ?? response.providerOrderId, providerResponse: safeProviderFields(response) });
  },
  async callback({ event }) {
    return result(event.shipped === true ? 'SHIPPED' : 'PENDING_SHIP', {
      providerReference: event.providerOrderId ?? event.orderId,
      trackingCode: event.trackingCode,
    });
  },
});
