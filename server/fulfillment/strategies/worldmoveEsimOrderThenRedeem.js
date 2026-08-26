import { result, extractProvisioningData, providerCallbackResult, safeProviderFields } from '../strategyUtils.js';

export const createWorldmoveEsimOrderThenRedeemStrategy = () => ({
  async execute({ order, item, itemId, providerClient, record }) {
    if (record?.itemData?.redemptionCode && providerClient?.redeem) {
      await providerClient.redeem({
        rcode: record.itemData.redemptionCode,
        qrcodeType: record.itemData.qrcodeType ?? 2,
        idempotencyKey: `${order.orderId}:${itemId}:REDEEM`,
      });
      return result('PENDING_CALLBACK', { providerReference: record.providerReference, itemData: record.itemData });
    }
    const response = await providerClient.createEsimOrder({
      email: order.email,
      wmproductId: item.providerWmproductId ?? item.wmproductId,
      quantity: item.quantity,
      idempotencyKey: `${order.orderId}:${itemId}:CREATE_ESIM_ORDER`,
    });
    return result('PENDING_CALLBACK', {
      providerReference: response.orderId ?? response.providerOrderId,
      providerResponse: safeProviderFields(response),
    });
  },
  async callback({ item, event, providerClient }) {
    const callbackItem = event.itemList?.[0] ?? event.item ?? event;
    const data = extractProvisioningData(callbackItem);
    const callbackResult = providerCallbackResult({ ...event, ...callbackItem });
    if (callbackResult.success === false) return result('FAILED', { providerReference: event.providerOrderId ?? event.orderId, failureCode: callbackResult.failureCode, providerResponse: safeProviderFields(callbackItem) });
    if (data.redemptionCode && !data.qrcode && providerClient?.redeem) {
      await providerClient.redeem({
        rcode: data.redemptionCode,
        qrcodeType: callbackItem.qrcodeType ?? 2,
        idempotencyKey: `${event.providerOrderId ?? event.orderId}:${item.variantId}:REDEEM`,
      });
      return result('PENDING_CALLBACK', { providerReference: event.providerOrderId ?? event.orderId, itemData: { ...data, qrcodeType: callbackItem.qrcodeType ?? 2 } });
    }
    return callbackResult.success === true
      ? result('PROVISIONED', { providerReference: event.providerOrderId ?? event.orderId, itemData: data })
      : result('PENDING_CALLBACK', { providerReference: event.providerOrderId ?? event.orderId, itemData: data, providerResponse: safeProviderFields(callbackItem) });
  },
});
