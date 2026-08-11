import { result, safeProviderFields } from '../strategyUtils.js';

export const createWorldmoveTopupStrategy = () => ({
  async execute({ order, item, itemId, providerClient }) {
    const response = await providerClient.topup({
      email: order.email,
      wmproductId: item.providerWmproductId ?? item.wmproductId,
      simNum: order.topup.simNum,
      day: order.topup.day,
      idempotencyKey: `${order.orderId}:${itemId}:TOPUP`,
    });
    return result(response.provisioned === true ? 'PROVISIONED' : 'PENDING_CALLBACK', {
      providerReference: response.orderId ?? response.providerOrderId,
      providerResponse: safeProviderFields(response),
    });
  },
  async callback({ event }) {
    return result(event.provisioned === true || event.code === 0 ? 'PROVISIONED' : 'PENDING_CALLBACK', {
      providerReference: event.providerOrderId ?? event.orderId,
    });
  },
});
