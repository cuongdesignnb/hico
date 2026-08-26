import path from 'node:path';
import { readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { CheckoutError } from './checkoutError.js';
import { validateCanonicalCart, validateCheckoutRequest } from './checkoutValidation.js';
import { createOrderSnapshot } from './checkoutSnapshot.js';
import { publicSkuForOrderItem, publicSkuForVariant } from '../catalog/public/publicSku.js';

const publicItem = ({ product, variant, requested }) => ({
  productId: product.id,
  productName: product.name,
  variantId: variant.id,
  sku: publicSkuForVariant(variant),
  quantity: requested.quantity,
  unitPrice: variant.price,
  currency: variant.currency,
  fulfillmentMethod: variant.fulfillmentMethod,
  medium: variant.medium,
});

const publicOrder = (order) => ({
  orderId: order.orderId,
  createdAt: order.createdAt,
  status: order.status,
  currency: order.currency,
  subtotal: order.subtotal,
  items: Array.isArray(order.items) ? order.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    variantId: item.variantId,
    sku: publicSkuForOrderItem(item),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    currency: item.currency,
  })) : [],
});

export const createCheckoutService = ({
  env = process.env,
  catalogReader,
  orderService,
  idempotencyRepository,
  fulfillmentBindingRepository = null,
  fulfillmentProfileRepository = null,
  customerAssetRepository = null,
  providerOffersFile = path.join(defaultUploadsDirectory, 'provider_offers.json'),
} = {}) => {
  let createQueue = Promise.resolve();
  const withCreateLock = (operation) => {
    const next = createQueue.then(operation, operation);
    createQueue = next.catch(() => undefined);
    return next;
  };
  const load = async (request, requireCustomer) => {
    const catalog = await catalogReader.readCatalog();
    const providerOffers = await readJson(providerOffersFile, []);
    const providerBindings = fulfillmentBindingRepository
      ? await fulfillmentBindingRepository.listActive('WORLDMOVE')
      : [];
    const providerProfiles = fulfillmentProfileRepository
      ? await fulfillmentProfileRepository.listActive('WORLDMOVE')
      : [];
    return validateCanonicalCart({ catalog, providerOffers, providerBindings, providerProfiles, request, requireCustomer });
  };
  const resolveRequest = async (request, customerIdentity) => {
    const assetId = typeof request?.topup?.simAssetId === 'string' ? request.topup.simAssetId.trim() : '';
    if (!assetId) return request;
    if (!customerIdentity?.id) throw new CheckoutError('Vui lòng đăng nhập để nạp từ SIM đã sở hữu.', 'CUSTOMER_AUTH_REQUIRED', 401);
    if (!customerAssetRepository?.resolveTopupSimNumber) {
      throw new CheckoutError('Tính năng nạp từ SIM đã sở hữu chưa sẵn sàng.', 'CUSTOMER_ASSET_NOT_READY', 503);
    }
    let simNum;
    try {
      simNum = await customerAssetRepository.resolveTopupSimNumber(customerIdentity.id, assetId);
    } catch (error) {
      if (error?.code === 'CUSTOMER_ASSETS_NOT_READY') {
        throw new CheckoutError('Tính năng nạp từ SIM đã sở hữu chưa sẵn sàng.', 'CUSTOMER_ASSET_NOT_READY', 503);
      }
      throw new CheckoutError('SIM đã chọn không khả dụng cho tài khoản này.', 'CUSTOMER_ASSET_INVALID', 422);
    }
    return { ...request, topup: { ...request.topup, simAssetId: assetId, simNum } };
  };
  return {
    engine: env.CHECKOUT_ENGINE ?? 'legacy',
    async validate(request, customerIdentity = null) {
      validateCheckoutRequest(request);
      const effectiveRequest = await resolveRequest(request, customerIdentity);
      const validated = await load(effectiveRequest, false);
      return {
        valid: true,
        currency: validated.currency,
        subtotal: validated.subtotal,
        items: validated.items.map(publicItem),
        errors: [],
        warnings: [],
      };
    },
    async createOrder(request, customerIdentity = null) {
      validateCheckoutRequest(request);
      if (typeof request.idempotencyKey !== 'string' || request.idempotencyKey.trim() === '') {
        throw new CheckoutError('Thiếu idempotencyKey.', 'CHECKOUT_INVALID_REQUEST');
      }
      return withCreateLock(async () => {
        const payloadHash = (idempotencyRepository.hash ?? idempotencyRepository.hashPayload)(request);
        const existing = await idempotencyRepository.get(request.idempotencyKey);
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            throw new CheckoutError('Idempotency key đã được dùng cho payload khác.', 'CHECKOUT_IDEMPOTENCY_CONFLICT', 409);
          }
          return { ...existing.response, idempotentReplay: true };
        }
        const resolvedRequest = await resolveRequest(request, customerIdentity);
        const effectiveRequest = customerIdentity ? {
          ...resolvedRequest,
          customer: {
            name: customerIdentity.displayName || resolvedRequest.customer?.name || 'Customer',
            email: customerIdentity.email,
            phone: customerIdentity.phone || resolvedRequest.customer?.phone || 'not-provided',
          },
        } : resolvedRequest;
        const validated = await load(effectiveRequest, true);
        const order = await orderService.createCanonicalOrder({
          request: effectiveRequest,
          validated,
          snapshotFactory: createOrderSnapshot,
          ownership: customerIdentity ? { customerId: customerIdentity.id, ownershipStatus: 'OWNED' } : {
            customerId: null,
            ownershipStatus: 'GUEST_UNCLAIMED',
            guestEmailSnapshot: validated.customer.email,
            guestPhoneSnapshot: validated.customer.phone,
          },
        });
        const response = { order: publicOrder(order), orderId: order.orderId, status: order.status };
        await idempotencyRepository.save({ key: request.idempotencyKey, payload: request, orderId: order.orderId, response });
        return response;
      });
    },
  };
};
