import {
  extractProvisioningData,
  result,
  safeProviderFields,
} from '../strategyUtils.js';

export const createWorldmoveEsimOrderThenRedeemStrategy = () => ({
  async execute({ order, item, itemId, providerClient, record }) {
    if (record?.itemData?.redemptionCode) {
      await providerClient.redeem({
        rcode: record.itemData.redemptionCode,
        qrcodeType: 2,
        idempotencyKey: `${order.orderId}:${itemId}:REDEEM`,
      });

      return result('PENDING_CALLBACK', {
        providerReference: record.providerReference,
        itemData: record.itemData,
      });
    }

    const response = await providerClient.createEsimOrder({
      email: order.email,
      wmproductId: item.providerWmproductId ?? item.wmproductId,
      quantity: item.quantity,
      idempotencyKey: `${order.orderId}:${itemId}:CREATE_ESIM`,
    });

    return result('PENDING_CALLBACK', {
      providerReference: response.orderId,
      providerResponse: safeProviderFields(response),
    });
  },

  async callback({ item, event, providerClient, record }) {
    if (event.providerSucceeded === false) {
      return result('FAILED', {
        providerReference: event.providerOrderId ?? event.orderId ?? record?.providerReference,
        internalNote: 'Worldmove callback reported failure.',
      });
    }
    const callbackItem = event.itemList?.[0] ?? event.item ?? event;
    const data = extractProvisioningData(callbackItem);

    if (data.redemptionCode && !data.qrcode) {
      await providerClient.redeem({
        rcode: data.redemptionCode,
        qrcodeType: 2,
        idempotencyKey:
          `${event.providerOrderId ?? event.orderId}:${item.variantId}:REDEEM`,
      });

      return result('PENDING_CALLBACK', {
        providerReference: event.providerOrderId ?? event.orderId ?? record?.providerReference,
        itemData: data,
      });
    }

    return result('PROVISIONED', {
      providerReference: event.providerOrderId ?? event.orderId ?? record?.providerReference,
      itemData: data,
    });
  },
});
