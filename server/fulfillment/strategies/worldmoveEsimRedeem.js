import { result, extractProvisioningData, providerCallbackResult, safeProviderFields } from '../strategyUtils.js';

export const createWorldmoveEsimRedeemStrategy = () => ({
  async execute({ order, item, itemId, providerClient, record }) {
    if (record?.itemData?.redemptionCode && providerClient?.redeem) {
      await providerClient.redeem({
        rcode: record.itemData.redemptionCode,
        qrcodeType: record.itemData.qrcodeType ?? 2,
        idempotencyKey: `${order.orderId}:${itemId}:REDEEM`,
      });
      return result('PENDING_CALLBACK', { providerReference: record.providerReference, itemData: record.itemData });
    }
    const response = await providerClient.createEsimOrderAndRedeem({
      wmproductId: item.providerWmproductId ?? item.wmproductId,
      quantity: item.quantity,
      qrcodeType: 2,
      idempotencyKey: `${order.orderId}:${itemId}:CREATE_ESIM_REDEEM`,
    });
    const callbackItem = response.itemList?.[0] ?? response.item ?? null;
    if (callbackItem) {
      const callbackResult = providerCallbackResult(callbackItem);
      if (callbackResult.success === false) return result('FAILED', { providerReference: response.orderId, failureCode: callbackResult.failureCode, providerResponse: safeProviderFields(callbackItem) });
      if (callbackResult.success === true) return result('PROVISIONED', { providerReference: response.orderId, itemData: extractProvisioningData(callbackItem) });
    }
    return result('PENDING_CALLBACK', { providerReference: response.orderId, providerResponse: safeProviderFields(response) });
  },
  async callback({ event }) {
    const callbackItem = event.itemList?.[0] ?? event.item ?? event;
    const data = extractProvisioningData(callbackItem);
    const callbackResult = providerCallbackResult({ ...event, ...callbackItem });
    if (callbackResult.success === false) return result('FAILED', { providerReference: event.providerOrderId ?? event.orderId, failureCode: callbackResult.failureCode, providerResponse: safeProviderFields(callbackItem) });
    return callbackResult.success === true
      ? result('PROVISIONED', { providerReference: event.providerOrderId ?? event.orderId, itemData: data })
      : result('PENDING_CALLBACK', { providerReference: event.providerOrderId ?? event.orderId, itemData: data, providerResponse: safeProviderFields(callbackItem) });
  },
});
