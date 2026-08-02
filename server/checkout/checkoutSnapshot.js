const optional = (value) => (
  value === undefined || value === null || value === '' ? undefined : value
);

export const createOrderItemSnapshot = ({ product, variant, quantity }) => ({
  productId: product.id,
  productName: product.name,
  productSlug: optional(product.slug),
  variantId: variant.id,
  sku: variant.sku,
  operation: product.operation,
  medium: variant.medium ?? null,
  supplier: variant.supplier,
  fulfillmentMethod: variant.fulfillmentMethod,
  quantity,
  unitPrice: variant.price,
  currency: variant.currency,
  providerOfferId: optional(variant.providerOfferId),
  wmproductId: optional(variant.wmproductId),
  providerProductType: optional(variant.providerProductType),
  leSIM: optional(variant.leSIM),
  coverageType: optional(product.coverageType),
  coverageIds: Array.isArray(product.coverageIds) ? [...product.coverageIds] : [],
  dataLimit: optional(variant.dataLimit),
  duration: optional(variant.duration),
});

export const createOrderSnapshot = ({ orderId, request, validated, createdAt }) => ({
  orderId,
  checkoutEngine: 'canonical',
  fulfillmentVersion: 1,
  email: validated.customer.email,
  customer: validated.customer,
  shippingAddress: validated.shipping,
  topup: validated.topup,
  currency: validated.currency,
  subtotal: validated.subtotal,
  qty: validated.items.reduce((sum, item) => sum + item.requested.quantity, 0),
  createdAt,
  status: 'PENDING_CALLBACK',
  items: validated.items.map(({ product, variant, requested }) => (
    createOrderItemSnapshot({ product, variant, quantity: requested.quantity })
  )),
  fulfillmentRecordIds: [],
  idempotencyKey: request.idempotencyKey,
});
