import { CheckoutError } from './checkoutError.js';
import { assertFulfillmentSupported } from '../fulfillment/fulfillmentValidation.js';
import { PROVIDER_RESOLUTION_CODES, resolveProviderOffer } from '../catalog/fulfillment/providerOfferResolver.js';
import { isLegacyFulfillmentMethod, isWorldmoveEsimOffer } from '../catalog/fulfillment/fulfillmentContracts.js';

export const CHECKOUT_ENGINES = new Set(['legacy', 'canonical']);
export const CURRENCIES = new Set(['VND', 'USD']);

export const readCheckoutEngine = (env = process.env) => {
  const value = env.CHECKOUT_ENGINE ?? 'canonical';
  if (!CHECKOUT_ENGINES.has(value)) {
    throw new CheckoutError(
      'CHECKOUT_ENGINE phải là legacy hoặc canonical.',
      'CHECKOUT_ENGINE_INVALID',
      500,
    );
  }
  return value;
};

const asText = (value, field, { required = true, max = 240 } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new CheckoutError(`Thiếu ${field}.`, 'CHECKOUT_INVALID_REQUEST');
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new CheckoutError(`${field} không hợp lệ.`, 'CHECKOUT_INVALID_REQUEST');
  }
  if (/[<>]/.test(value)) {
    throw new CheckoutError(`${field} không hợp lệ.`, 'CHECKOUT_INVALID_REQUEST');
  }
  return value.trim();
};

const validateCustomer = (customer = {}) => ({
  name: asText(customer.name, 'Họ tên', { max: 120 }),
  email: (() => {
    const value = asText(customer.email, 'Email', { max: 254 });
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      throw new CheckoutError('Email không hợp lệ.', 'CHECKOUT_INVALID_REQUEST');
    }
    return value.toLowerCase();
  })(),
  phone: asText(customer.phone, 'Số điện thoại', { max: 40 }),
});

export const validateShipping = (shipping, required) => {
  if (!required && shipping === null) return null;
  if (!shipping || typeof shipping !== 'object' || Array.isArray(shipping)) {
    if (required) throw new CheckoutError('Vui lòng nhập thông tin giao hàng.', 'SHIPPING_REQUIRED');
    return null;
  }
  const result = {
    recipientName: asText(shipping.recipientName ?? shipping.name, 'Tên người nhận', { max: 120 }),
    phone: asText(shipping.phone, 'Số điện thoại nhận hàng', { max: 40 }),
    addressLine: asText(shipping.addressLine ?? shipping.address, 'Địa chỉ', { max: 240 }),
    ward: asText(shipping.ward, 'Phường/Xã', { max: 120 }),
    district: asText(shipping.district, 'Quận/Huyện', { max: 120 }),
    province: asText(shipping.province ?? shipping.city, 'Tỉnh/Thành phố', { max: 120 }),
    country: asText(shipping.country ?? 'VN', 'Quốc gia', { max: 80 }),
  };
  return result;
};

export const validateTopup = (topup, required) => {
  if (!required && topup === null) return null;
  if (!topup || typeof topup !== 'object' || Array.isArray(topup)) {
    if (required) throw new CheckoutError('Vui lòng nhập thông tin top-up.', 'TOPUP_INPUT_INVALID');
    return null;
  }
  const simAssetId = typeof topup.simAssetId === 'string' && topup.simAssetId.trim()
    ? asText(topup.simAssetId, 'SIM đã chọn', { max: 120 })
    : undefined;
  const simNum = simAssetId
    ? undefined
    : asText(topup.simNum, 'SIM cần top-up', { max: 20 });
  if (simNum && !/^\d{20}$/.test(simNum)) throw new CheckoutError('Số SIM phải gồm đúng 20 chữ số.', 'SIM_NUMBER_INVALID');
  const day = Number(topup.day ?? topup.days);
  if (!Number.isInteger(day) || day < 1 || day > 30) {
    throw new CheckoutError('Số ngày top-up không hợp lệ.', 'TOPUP_INPUT_INVALID');
  }
  return { ...(simNum ? { simNum } : {}), day, ...(simAssetId ? { simAssetId } : {}) };
};

const canonicalTopupDays = (variant) => variant?.topupDays
  ?? (variant?.durationUnit === 'day' ? variant.durationValue : null)
  ?? variant?.durationDays
  ?? null;

const expectedWorldmoveProductType = (product, variant) => {
  if (product?.operation === 'topup') return 2;
  if (product?.operation === 'new_subscription' && variant?.medium === 'esim') return 0;
  if (product?.operation === 'new_subscription' && variant?.medium === 'physical_sim') return 1;
  return null;
};

const validateItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutError('Giỏ hàng đang trống.', 'CART_EMPTY');
  }
  return items.map((item) => {
    const variantId = asText(item?.variantId, 'variantId', { max: 120 });
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new CheckoutError('Số lượng sản phẩm không hợp lệ.', 'CHECKOUT_INVALID_REQUEST');
    }
    const requestedTripDays = item?.requestedTripDays;
    if (requestedTripDays !== undefined && (!Number.isInteger(Number(requestedTripDays)) || Number(requestedTripDays) < 1)) {
      throw new CheckoutError('Số ngày chuyến đi không hợp lệ.', 'TRIP_DAY_INVALID');
    }
    return {
      variantId,
      quantity,
      clientPrice: item?.clientPrice,
      ...(requestedTripDays !== undefined ? { requestedTripDays: Number(requestedTripDays) } : {}),
    };
  });
};

const findOffer = (offers, variant) => {
  if (!Array.isArray(offers)) return null;
  return offers.find((offer) => (
    offer?.id === variant.providerOfferId
    || (variant.wmproductId && offer?.wmproductId === variant.wmproductId)
  )) ?? null;
};

const validateProviderMapping = (variant, offers) => {
  const providerMethods = new Set([
    'WORLDMOVE_ESIM_REDEEM',
    'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  ]);
  if (!providerMethods.has(variant.fulfillmentMethod)) return null;
  const offer = findOffer(offers, variant);
  const expectsLeSIM = variant.fulfillmentMethod === 'WORLDMOVE_ESIM_REDEEM';
  if (!offer || !isWorldmoveEsimOffer(offer) || offer.leSIM !== expectsLeSIM) {
    throw new CheckoutError('Nguồn cung cấp của gói không còn hoạt động.', 'PROVIDER_OFFER_INACTIVE');
  }
  if (variant.providerOfferId && offer.id !== variant.providerOfferId) {
    throw new CheckoutError('Provider Offer của gói không khớp.', 'FULFILLMENT_INVALID');
  }
  if (variant.wmproductId && offer.wmproductId !== variant.wmproductId) {
    throw new CheckoutError('wmproductId của gói không khớp Provider Offer.', 'FULFILLMENT_INVALID');
  }
  return offer;
};

export const validateCanonicalCart = ({ catalog, providerOffers = [], providerBindings = [], providerProfiles = [], providerResolver = resolveProviderOffer, request, requireCustomer = true }) => {
  const requestedItems = validateItems(request?.items);
  const productsById = new Map((catalog?.products ?? []).map((product) => [product.id, product]));
  const variantsById = new Map((catalog?.variants ?? []).map((variant) => [variant.id, variant]));
  const resolved = [];

  for (const requested of requestedItems) {
    const variant = variantsById.get(requested.variantId);
    if (!variant) throw new CheckoutError('Không tìm thấy biến thể sản phẩm.', 'VARIANT_NOT_FOUND');
    const product = productsById.get(variant.productId);
    if (!product) throw new CheckoutError('Không tìm thấy sản phẩm.', 'PRODUCT_NOT_FOUND');
    if (variant.medium === 'esim' && requested.quantity !== 1) {
      throw new CheckoutError(
        'Mỗi checkout eSIM chỉ hỗ trợ số lượng 1.',
        'ESIM_QUANTITY_UNSUPPORTED',
        422,
      );
    }
    if (product.status === 'archived') throw new CheckoutError('Sản phẩm đã được lưu trữ.', 'VARIANT_NOT_AVAILABLE');
    if (product.operationResolution === 'UNRESOLVED' || variant.operationResolution === 'UNRESOLVED') {
      throw new CheckoutError('Nghiệp vụ của sản phẩm chưa được xác nhận.', 'CANONICAL_OPERATION_UNRESOLVED');
    }
    if (product.status !== 'active' || variant.active !== true || variant.needsReview === true) {
      throw new CheckoutError('Sản phẩm không thể thanh toán lúc này.', 'VARIANT_NOT_AVAILABLE');
    }
    if (isLegacyFulfillmentMethod(variant.fulfillmentMethod) || product.operation === 'topup') {
      throw new CheckoutError(
        'Nguồn cấp này đã ngừng hỗ trợ cho đơn hàng mới.',
        'FULFILLMENT_RETIRED',
        410,
      );
    }
    if (typeof variant.price !== 'number' || !Number.isFinite(variant.price) || variant.price < 0) {
      throw new CheckoutError('Giá sản phẩm không hợp lệ.', 'FULFILLMENT_INVALID');
    }
    if (!CURRENCIES.has(variant.currency)) {
      throw new CheckoutError('Loại tiền của sản phẩm không được hỗ trợ.', 'FULFILLMENT_INVALID');
    }
    if (requested.clientPrice !== undefined) {
      const clientPrice = Number(requested.clientPrice);
      if (Number.isFinite(clientPrice) && clientPrice !== variant.price) {
        throw new CheckoutError('Giá của một số sản phẩm đã thay đổi. Vui lòng kiểm tra lại đơn hàng.', 'PRICE_CHANGED', 409);
      }
    }
    const activeBinding = providerBindings.find((binding) => (
      binding.variantId === variant.id
      && binding.provider === 'WORLDMOVE'
      && binding.status === 'ACTIVE'
    )) ?? null;
    const activeProfile = providerProfiles.find((profile) => (
      profile.variantId === variant.id
      && profile.provider === 'WORLDMOVE'
      && profile.status === 'ACTIVE'
    )) ?? null;
    const usesProviderResolver = Boolean(activeProfile || variant.durationDays || variant.familyKey || activeBinding);
    let providerResolution = null;
    let providerOffer;
    if (usesProviderResolver) {
      providerResolution = providerResolver({ variant, offers: providerOffers, activeBinding, fulfillmentProfile: activeProfile, requireFulfillmentProfile: Boolean(activeProfile) });
      if (!providerResolution.ok) {
        throw new CheckoutError(
          providerResolution.reason,
          providerResolution.code,
          providerResolution.code === PROVIDER_RESOLUTION_CODES.AMBIGUOUS ? 409 : 422,
        );
      }
      providerOffer = providerOffers.find((offer) => offer.id === providerResolution.providerOfferId) ?? null;
    } else {
      providerOffer = validateProviderMapping(variant, providerOffers);
    }
    const fulfillmentVariant = providerResolution?.fulfillmentMethod
      ? {
        ...variant,
        supplier: 'worldmove',
        fulfillmentMethod: providerResolution.fulfillmentMethod,
        wmproductId: providerResolution.providerWmproductId,
        providerOfferId: providerResolution.providerOfferId,
        providerProductType: providerOffer?.providerProductType,
        leSIM: providerOffer?.leSIM,
        operation: variant.operation ?? product.operation,
      }
      : { ...variant, operation: variant.operation ?? product.operation };
    const expectedProviderType = expectedWorldmoveProductType(product, variant);
    if (expectedProviderType !== null && (product.operation === 'topup' || String(fulfillmentVariant.fulfillmentMethod ?? '').startsWith('WORLDMOVE_'))) {
      if (!providerOffer || providerOffer.providerProductType !== expectedProviderType) {
        throw new CheckoutError('Loại sản phẩm Worldmove không khớp nghiệp vụ của gói.', 'PROVIDER_PRODUCT_TYPE_MISMATCH');
      }
    }
    const allowedTripDays = Array.isArray(variant.tripDayOptions) ? variant.tripDayOptions : [];
    if (
      product.operation === 'new_subscription'
      && variant.medium === 'esim'
      && allowedTripDays.length > 1
      && requested.requestedTripDays === undefined
    ) {
      throw new CheckoutError('Vui lòng chọn số ngày chuyến đi.', 'TRIP_DAY_REQUIRED');
    }
    if (requested.requestedTripDays !== undefined) {
      if (product.operation === 'topup' || variant.medium !== 'esim') {
        throw new CheckoutError('Số ngày chuyến đi chỉ áp dụng cho eSIM.', 'TRIP_DAY_NOT_APPLICABLE');
      }
      if (!allowedTripDays.includes(requested.requestedTripDays)) {
        throw new CheckoutError('Số ngày chuyến đi không khớp với biến thể canonical.', 'TRIP_DAY_MISMATCH');
      }
    }
    assertFulfillmentSupported(fulfillmentVariant);
    const requiresShipping = product.operation === 'device_sale'
      || (product.operation === 'new_subscription' && variant.medium === 'physical_sim');
    const requiresTopup = product.operation === 'topup' || fulfillmentVariant.fulfillmentMethod === 'WORLDMOVE_TOPUP';
    resolved.push({
      requested,
      product,
      variant,
      providerOffer,
      providerResolution,
      requiresShipping,
      requiresTopup,
    });
  }

  const topupItems = resolved.filter((item) => item.requiresTopup);
  if (topupItems.length > 0) {
    if (topupItems.length !== 1 || resolved.length !== 1) {
      throw new CheckoutError(
        'Nạp SIM phải được thanh toán riêng trong một checkout.',
        'TOPUP_CART_MIXED_UNSUPPORTED',
        422,
      );
    }
    if (topupItems[0].requested.quantity !== 1) {
      throw new CheckoutError(
        'Mỗi checkout chỉ được có số lượng Nạp SIM là 1.',
        'TOPUP_QUANTITY_INVALID',
        422,
      );
    }
  }

  const currencies = [...new Set(resolved.map(({ variant }) => variant.currency))];
  if (currencies.length > 1) {
    throw new CheckoutError(
      'Không thể thanh toán chung các sản phẩm khác tiền tệ.',
      'MIXED_CURRENCY_CART',
    );
  }
  const shipping = validateShipping(request?.shipping, resolved.some((item) => item.requiresShipping));
  const topup = validateTopup(request?.topup, resolved.some((item) => item.requiresTopup));
  for (const item of resolved.filter((candidate) => candidate.requiresTopup)) {
    const expectedDay = canonicalTopupDays(item.variant);
    if (!expectedDay) {
      throw new CheckoutError('Biến thể top-up chưa có số ngày canonical.', 'TOPUP_DAY_UNRESOLVED');
    }
    if (expectedDay && expectedDay !== topup.day) {
      throw new CheckoutError('Số ngày top-up không khớp với biến thể canonical.', 'TOPUP_DAY_MISMATCH');
    }
  }
  return {
    customer: requireCustomer ? validateCustomer(request?.customer) : null,
    items: resolved,
    shipping,
    topup,
    currency: currencies[0],
    subtotal: resolved.reduce((sum, item) => sum + item.variant.price * item.requested.quantity, 0),
  };
};

export const validateCheckoutRequest = (request) => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new CheckoutError('Dữ liệu checkout không hợp lệ.', 'CHECKOUT_INVALID_REQUEST');
  }
  if (request.idempotencyKey !== undefined) {
    asText(request.idempotencyKey, 'idempotencyKey', { max: 200 });
  }
  return request;
};
