export const isOwnedCustomerAssetOrder = (order, customerId) => Boolean(order?.ownershipStatus === 'OWNED' && order.customerId && order.customerId === customerId);
