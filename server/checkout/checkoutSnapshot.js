import { publicSkuForVariant } from '../catalog/public/publicSku.js';

const optional = (value) => (
  value === undefined || value === null || value === '' ? undefined : value
);

const deviceSnapshot = (product, variant) => {
  const value = product.deviceSpecs ?? variant.deviceSpecs;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = ['brand', 'model', 'networkGeneration', 'formFactor', 'supportedBands', 'wifiStandard', 'maxConnectedDevices', 'batteryCapacity', 'ethernetPorts', 'usbPorts', 'simCompatibility', 'dimensions', 'weight', 'color', 'warrantyMonths'];
  return Object.fromEntries(allowed.filter((key) => value[key] !== undefined && value[key] !== null).map((key) => [key, value[key]]));
};

export const createOrderItemSnapshot = ({ product, variant, providerOffer = null, providerResolution = null, quantity, requestedTripDays = undefined }) => ({
  productId: product.id,
  productName: product.name,
  productSlug: optional(product.slug),
  variantId: variant.id,
  sku: publicSkuForVariant(variant),
  publicSku: publicSkuForVariant(variant),
  operation: product.operation,
  medium: variant.medium ?? null,
  supplier: providerResolution ? 'worldmove' : variant.supplier,
  fulfillmentMethod: providerResolution?.fulfillmentMethod ?? variant.fulfillmentMethod,
  quantity,
  unitPrice: variant.price,
  currency: variant.currency,
  providerOfferId: optional(providerResolution?.providerOfferId ?? variant.providerOfferId),
  wmproductId: optional(providerResolution?.providerWmproductId ?? variant.wmproductId),
  providerWmproductId: optional(providerResolution?.providerWmproductId ?? variant.wmproductId),
  provider: optional(providerResolution?.provider ?? variant.supplier),
  providerProductType: optional(providerOffer?.providerProductType ?? variant.providerProductType),
  leSIM: optional(providerOffer?.leSIM ?? variant.leSIM),
  soldVariantId: variant.id,
  soldSku: variant.sku,
  soldDurationDays: providerResolution?.requestedDays ?? variant.durationDays ?? null,
  ...(Number.isInteger(requestedTripDays) && requestedTripDays > 0 ? { requestedTripDays } : {}),
  ...(Array.isArray(variant.tripDayOptions) ? { tripDayOptions: [...variant.tripDayOptions] } : {}),
  topupDays: variant.topupDays ?? (variant.durationUnit === 'day' ? variant.durationValue : null) ?? variant.durationDays ?? null,
  soldDataLimit: optional(variant.dataLimit),
  soldPrice: variant.price,
  soldCurrency: variant.currency,
  providerDurationDays: providerResolution?.providerDurationDays ?? null,
  fulfillmentStrategy: providerResolution?.strategy ?? null,
  upgradeDays: providerResolution?.upgradeDays ?? 0,
  bindingVersion: providerResolution?.bindingVersion ?? null,
  providerSnapshotHash: providerResolution?.providerSnapshotHash ?? null,
  coverageType: optional(product.coverageType),
  coverageIds: Array.isArray(product.coverageIds) ? [...product.coverageIds] : [],
  dataLimit: optional(variant.dataLimit),
  duration: optional(variant.duration),
  deviceSpecs: deviceSnapshot(product, variant),
});

export const createOrderSnapshot = ({ orderId, request, validated, createdAt, ownership = {} }) => ({
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
  items: validated.items.map(({ product, variant, providerOffer, providerResolution, requested }) => (
    createOrderItemSnapshot({ product, variant, providerOffer, providerResolution, quantity: requested.quantity, requestedTripDays: requested.requestedTripDays })
  )),
  fulfillmentRecordIds: [],
  idempotencyKey: request.idempotencyKey,
  customerId: ownership.customerId ?? null,
  ownershipStatus: ownership.ownershipStatus ?? 'GUEST_UNCLAIMED',
  guestEmailSnapshot: ownership.guestEmailSnapshot ?? null,
  guestPhoneSnapshot: ownership.guestPhoneSnapshot ?? null,
});
