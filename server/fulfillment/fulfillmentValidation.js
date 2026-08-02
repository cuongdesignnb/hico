import { CheckoutError } from '../checkout/checkoutError.js';

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
  const valid = {
    WORLDMOVE_ESIM_REDEEM: item.medium === 'esim' && item.supplier === 'worldmove' && item.providerProductType === 0 && item.leSIM === true,
    WORLDMOVE_ESIM_ORDER_THEN_REDEEM: item.medium === 'esim' && item.supplier === 'local_carrier' && item.providerProductType === 0 && item.leSIM === false,
    HICO_MANUAL_QR: item.medium === 'esim' && item.supplier === 'hico',
    WORLDMOVE_PHYSICAL_ORDER: item.medium === 'physical_sim' && item.supplier === 'worldmove' && item.providerProductType === 1,
    HICO_PHYSICAL_STOCK: item.medium === 'physical_sim' && item.supplier === 'hico',
    WORLDMOVE_TOPUP: item.operation === 'topup' && item.supplier === 'worldmove' && item.providerProductType === 2,
    MANUAL_PROCESSING: true,
  }[method];
  if (!valid) throw new CheckoutError('Thông tin nguồn cấp của gói không tương thích.', 'FULFILLMENT_INVALID');
  return method;
};

export const providerAttemptKey = ({ orderId, itemId, type }) => `${orderId}:${itemId}:${type}`;
