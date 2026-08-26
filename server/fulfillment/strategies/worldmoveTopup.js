import { result, safeProviderFields } from '../strategyUtils.js';

export const createWorldmoveTopupStrategy = () => ({
  async execute({ order, item, itemId, providerClient }) {
    const canonicalDays = item.topupDays ?? (item.durationUnit === 'day' ? item.durationValue : null) ?? item.durationDays;
    const requestedDay = Number(order.topup?.day);
    if (canonicalDays && requestedDay !== canonicalDays) {
      const error = new Error('Số ngày top-up không khớp với biến thể canonical.');
      error.code = 'TOPUP_DAY_MISMATCH';
      error.retryable = false;
      throw error;
    }
    const response = await providerClient.topup({
      wmproductId: item.providerWmproductId ?? item.wmproductId,
      simNum: order.topup.simNum,
      day: requestedDay,
      idempotencyKey: `${order.orderId}:${itemId}:TOPUP`,
    });
    return result('PENDING_CALLBACK', {
      providerReference: response.orderId ?? response.providerOrderId,
      providerResponse: safeProviderFields(response),
    });
  },
  async callback({ event }) {
    const items = Array.isArray(event.itemList) ? event.itemList : [];
    const successful = items.length > 0 && items.every((item) => Number(item.code) === 1);
    if (!successful) {
      return result('FAILED', {
        providerReference: event.providerOrderId ?? event.orderId,
        failureCode: items.find((item) => Number(item.code) !== 1)?.code ?? 'TOPUP_CALLBACK_INVALID',
        providerResponse: safeProviderFields(event),
      });
    }
    return result('PROVISIONED', {
      providerReference: event.providerOrderId ?? event.orderId,
      completedAt: new Date().toISOString(),
      itemData: { topupDays: items[0].day },
    });
  },
});
