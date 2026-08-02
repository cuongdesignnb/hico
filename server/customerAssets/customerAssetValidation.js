export const validateCustomerAssetOwnership = (asset, order, customerId) => Boolean(asset?.orderId === order?.orderId && order?.ownershipStatus === 'OWNED' && order.customerId === customerId);
export const hasRawCustomerAssetSecret = (value) => /qrcodeContent|redemptionCode|pin1|pin2|puk1|puk2|LPA:/i.test(JSON.stringify(value ?? {}));
