import { CheckoutError } from '../checkout/checkoutError.js';
import { isLegacyFulfillmentMethod } from '../catalog/fulfillment/fulfillmentContracts.js';

export const FULFILLMENT_METHODS = new Set([
  'WORLDMOVE_ESIM_REDEEM',
  'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  'HICO_MANUAL_QR',
  'WORLDMOVE_PHYSICAL_ORDER',
  'HICO_PHYSICAL_STOCK',
  'WORLDMOVE_TOPUP',
  'MANUAL_PROCESSING',
]);

export const assertFulfillmentSupported = (item) => {
  const method = item.fulfillmentMethod;
  if (!FULFILLMENT_METHODS.has(method)) {
    throw new CheckoutError('Nguồn cấp của gói chưa được hỗ trợ.', 'FULFILLMENT_UNSUPPORTED');
  }
  if (isLegacyFulfillmentMethod(method)) {
    throw new CheckoutError(
      'Nguồn cấp này đã ngừng hỗ trợ cho đơn hàng mới.',
      'FULFILLMENT_RETIRED',
      410,
    );
  }
  const valid = {
    WORLDMOVE_ESIM_REDEEM: item.medium === 'esim' && item.supplier === 'worldmove' && item.providerProductType === 0 && item.leSIM === true && Boolean(String(item.wmproductId ?? '').trim()),
    WORLDMOVE_ESIM_ORDER_THEN_REDEEM: item.medium === 'esim' && item.supplier === 'worldmove' && item.providerProductType === 0 && item.leSIM === false && Boolean(String(item.wmproductId ?? '').trim()),
    HICO_MANUAL_QR: item.medium === 'esim'
      && item.supplier === 'hico'
      && !item.wmproductId
      && !item.providerOfferId
      && item.providerProductType == null
      && item.leSIM == null
      && item.shippingRequired !== true,
    HICO_PHYSICAL_STOCK: item.medium === 'physical_sim'
      && item.supplier === 'hico'
      && !item.wmproductId
      && !item.providerOfferId
      && item.providerProductType == null
      && item.leSIM == null
      && item.shippingRequired !== false,
    MANUAL_PROCESSING: true,
  }[method];
  if (!valid) throw new CheckoutError('Thông tin nguồn cấp của gói không tương thích.', 'FULFILLMENT_INVALID');
  return method;
};

export const providerAttemptKey = ({ orderId, itemId, type }) => `${orderId}:${itemId}:${type}`;
