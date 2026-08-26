import type { CartItem } from '../context/contextValue';

export type CartMedium = 'esim' | 'physical_sim' | null;

export const cartMediumFor = (item: Pick<CartItem, 'medium' | 'type'>): CartMedium => {
  if (item.medium === 'esim' || item.medium === 'physical_sim') return item.medium;
  if (item.type === 'physical') return 'physical_sim';
  if (item.type === 'esim') return 'esim';
  return null;
};

export const cartOperationFor = (item: Pick<CartItem, 'operation' | 'type'>) => {
  if (item.operation === 'new_subscription' || item.operation === 'topup' || item.operation === 'device_sale') return item.operation;
  return item.type === 'device' ? 'device_sale' : 'new_subscription';
};

export const requiresShippingForCartItem = (item: Pick<CartItem, 'operation' | 'medium' | 'type'>) => {
  const operation = cartOperationFor(item);
  return operation === 'device_sale' || (operation === 'new_subscription' && cartMediumFor(item) === 'physical_sim');
};

export const requiresTopupForCartItem = (item: Pick<CartItem, 'operation' | 'type'>) => cartOperationFor(item) === 'topup';

export const cartLabelFor = (item: Pick<CartItem, 'operation' | 'medium' | 'type'>) => {
  const operation = cartOperationFor(item);
  if (operation === 'topup') return 'Nạp SIM';
  if (operation === 'device_sale') return 'Thiết bị';
  return cartMediumFor(item) === 'physical_sim' ? 'SIM vật lý' : 'eSIM';
};
