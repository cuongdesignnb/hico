import path from 'node:path';
import { readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { CheckoutError } from './checkoutError.js';
import { validateCanonicalCart, validateCheckoutRequest } from './checkoutValidation.js';
import { createOrderSnapshot } from './checkoutSnapshot.js';

const publicItem = ({ product, variant, requested }) => ({
  productId: product.id,
  productName: product.name,
  variantId: variant.id,
  sku: variant.sku,
  quantity: requested.quantity,
  unitPrice: variant.price,
  currency: variant.currency,
  fulfillmentMethod: variant.fulfillmentMethod,
  medium: variant.medium,
});

export const createCheckoutService = ({
  env = process.env,
  catalogReader,
  orderService,
  idempotencyRepository,
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
    return validateCanonicalCart({ catalog, providerOffers, request, requireCustomer });
  };
  return {
    engine: env.CHECKOUT_ENGINE ?? 'legacy',
    async validate(request) {
      validateCheckoutRequest(request);
      const validated = await load(request, false);
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
        const effectiveRequest = customerIdentity ? {
          ...request,
          customer: {
            name: customerIdentity.displayName || request.customer?.name || 'Customer',
            email: customerIdentity.email,
            phone: customerIdentity.phone || request.customer?.phone || 'not-provided',
          },
        } : request;
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
        const response = { order, orderId: order.orderId, status: order.status };
        await idempotencyRepository.save({ key: request.idempotencyKey, payload: request, orderId: order.orderId, response });
        return response;
      });
    },
  };
};
