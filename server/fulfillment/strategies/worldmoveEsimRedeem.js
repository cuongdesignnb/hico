import { result, extractProvisioningData, safeProviderFields } from '../strategyUtils.js';

export const createWorldmoveEsimRedeemStrategy = () => ({
  async execute({ order, item, itemId, providerClient, record }) {
    if (record?.itemData?.redemptionCode && providerClient?.redeem) {
      await providerClient.redeem({
        rcode: record.itemData.redemptionCode,
        qrcodeType: record.itemData.qrcodeType ?? 0,
        idempotencyKey: `${order.orderId}:${itemId}:REDEEM`,
      });
      return result('PENDING_CALLBACK', { providerReference: record.providerReference, itemData: record.itemData });
    }
    const response = await providerClient.createEsimOrder({
      email: '0',
      wmproductId: item.wmproductId,
      quantity: item.quantity,
      redeem: true,
      idempotencyKey: `${order.orderId}:${itemId}:CREATE_ESIM_REDEEM`,
    });
    const callbackItem = response.itemList?.[0] ?? response.item ?? null;
    if (callbackItem) return result('PROVISIONED', { providerReference: response.orderId, itemData: extractProvisioningData(callbackItem) });
    return result('PENDING_CALLBACK', { providerReference: response.orderId, providerResponse: safeProviderFields(response) });
  },
  async callback({ item, event, providerClient }) {
    const callbackItem = event.itemList?.[0] ?? event.item ?? event;
    const data = extractProvisioningData(callbackItem);
    if (data.redemptionCode && !data.qrcode && providerClient?.redeem) {
      await providerClient.redeem({
        rcode: data.redemptionCode,
        qrcodeType: callbackItem.qrcodeType ?? 0,
        idempotencyKey: `${event.providerOrderId ?? event.orderId}:${item.variantId}:REDEEM`,
      });
      return result('PENDING_CALLBACK', { providerReference: event.providerOrderId ?? event.orderId, itemData: data });
    }
    return result('PROVISIONED', { providerReference: event.providerOrderId ?? event.orderId, itemData: data });
  },
});
