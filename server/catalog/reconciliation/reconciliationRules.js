import { createHash } from 'node:crypto';

const WORLD_MOVE_RESOLUTIONS = new Set([
  'WORLDMOVE_ESIM_REDEEM',
  'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  'WORLDMOVE_PHYSICAL_ORDER',
  'WORLDMOVE_TOPUP',
]);

export const snapshotProviderOffer = (offer) => {
  if (!offer) return undefined;
  if (typeof offer.rawHash === 'string' && offer.rawHash !== '') {
    return offer.rawHash;
  }

  return createHash('sha256')
    .update(JSON.stringify({
      id: offer.id,
      wmproductId: offer.wmproductId,
      providerProductType: offer.providerProductType,
      leSIM: offer.leSIM,
      active: offer.active,
    }))
    .digest('hex');
};

export const resolutionForProviderOffer = (offer) => {
  if (offer?.providerProductType === 0 && offer.leSIM === true) {
    return 'WORLDMOVE_ESIM_REDEEM';
  }
  if (offer?.providerProductType === 0 && offer.leSIM === false) {
    return 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM';
  }
  if (offer?.providerProductType === 1) {
    return 'WORLDMOVE_PHYSICAL_ORDER';
  }
  if (offer?.providerProductType === 2) {
    return 'WORLDMOVE_TOPUP';
  }
  return undefined;
};

const hasManualQrReference = (variant) => Boolean(
  variant.manualQrReference
  || variant.manualQrId
  || variant.qrCodeId
  || variant.qrInventoryId,
);

const isManualVariant = (variant) => (
  variant.legacySimType === 'manual'
  || variant.fulfillmentMethod === 'HICO_MANUAL_QR'
);

const isPhysicalVariant = (variant) => (
  variant.legacySimType === 'physical'
  || variant.medium === 'physical_sim'
  || variant.fulfillmentMethod === 'HICO_PHYSICAL_STOCK'
);

const buildResult = ({
  product,
  variant,
  now,
  status,
  reason,
  offer,
  suggestedResolution,
}) => ({
  productId: product.id,
  variantId: variant.id,
  sku: variant.sku,
  ...(variant.wmproductId ? { wmproductId: variant.wmproductId } : {}),
  ...(offer ? { providerOfferId: offer.id } : {}),
  status,
  ...(suggestedResolution ? { suggestedResolution } : {}),
  reason,
  ...(offer ? { providerSnapshotHash: snapshotProviderOffer(offer) } : {}),
  createdAt: now,
  updatedAt: now,
});

export const reconcileCatalogVariant = ({
  product,
  variant,
  matchingOffers,
  now,
}) => {
  if (!variant.wmproductId) {
    return buildResult({
      product,
      variant,
      now,
      status: 'MISSING_WMPRODUCT_ID',
      reason: 'Variant chưa có wmproductId để đối chiếu chính xác.',
    });
  }

  if (matchingOffers.length === 0) {
    return buildResult({
      product,
      variant,
      now,
      status: 'NOT_FOUND',
      reason: 'Không tìm thấy offer Worldmove có cùng wmproductId.',
    });
  }

  if (matchingOffers.length > 1) {
    return buildResult({
      product,
      variant,
      now,
      status: 'DUPLICATE_PROVIDER_OFFER',
      reason: 'Có nhiều offer Worldmove cùng wmproductId; cần Admin chọn rõ offer.',
    });
  }

  const offer = matchingOffers[0];
  const suggestedResolution = resolutionForProviderOffer(offer);

  if (!offer.active) {
    return buildResult({
      product,
      variant,
      now,
      offer,
      suggestedResolution,
      status: 'INACTIVE_PROVIDER_OFFER',
      reason: 'Offer Worldmove đã ngừng cung cấp.',
    });
  }

  if (!suggestedResolution) {
    return buildResult({
      product,
      variant,
      now,
      offer,
      status: 'NEEDS_REVIEW',
      reason: 'Offer Worldmove thiếu loại sản phẩm hoặc nguồn eSIM cần thiết.',
    });
  }

  if (isManualVariant(variant)) {
    return buildResult({
      product,
      variant,
      now,
      offer,
      suggestedResolution,
      status: 'LEGACY_CONFLICT',
      reason: 'Variant legacy đang dùng QR riêng HICO nhưng khớp offer Worldmove.',
    });
  }

  if (isPhysicalVariant(variant) && offer.providerProductType === 0) {
    return buildResult({
      product,
      variant,
      now,
      offer,
      suggestedResolution,
      status: 'LEGACY_CONFLICT',
      reason: 'Variant legacy là SIM vật lý nhưng offer Worldmove là eSIM.',
    });
  }

  if (hasManualQrReference(variant) && WORLD_MOVE_RESOLUTIONS.has(suggestedResolution)) {
    return buildResult({
      product,
      variant,
      now,
      offer,
      suggestedResolution,
      status: 'LEGACY_CONFLICT',
      reason: 'Variant đang liên kết QR thủ công; không tự chuyển sang Worldmove.',
    });
  }

  if (offer.providerProductType === 2 && product.operation !== 'topup') {
    return buildResult({
      product,
      variant,
      now,
      offer,
      suggestedResolution,
      status: 'TYPE_CONFLICT',
      reason: 'Offer là Top-up nhưng sản phẩm catalog không có operation topup.',
    });
  }

  if (product.operation === 'topup' && offer.providerProductType !== 2) {
    return buildResult({
      product,
      variant,
      now,
      offer,
      suggestedResolution,
      status: 'TYPE_CONFLICT',
      reason: 'Sản phẩm catalog là Top-up nhưng offer Worldmove không phải Top-up.',
    });
  }

  if (!isPhysicalVariant(variant) && offer.providerProductType === 1) {
    return buildResult({
      product,
      variant,
      now,
      offer,
      suggestedResolution,
      status: 'TYPE_CONFLICT',
      reason: 'Variant catalog không phải SIM vật lý nhưng offer Worldmove là SIM vật lý.',
    });
  }

  return buildResult({
    product,
    variant,
    now,
    offer,
    suggestedResolution,
    status: 'MATCHED',
    reason: 'Khớp chính xác wmproductId và loại fulfillment Worldmove.',
  });
};

export const validateResolutionForContext = ({
  resolution,
  product,
  variant,
  offer,
}) => {
  if (resolution === 'MANUAL_PROCESSING') return;

  if (resolution === 'HICO_MANUAL_QR') {
    if (variant.medium !== 'esim') {
      throw new Error('QR riêng HICO chỉ áp dụng cho variant eSIM.');
    }
    return;
  }

  if (resolution === 'HICO_PHYSICAL_STOCK') {
    if (variant.medium !== 'physical_sim') {
      throw new Error('SIM kho HICO chỉ áp dụng cho variant SIM vật lý.');
    }
    return;
  }

  if (!offer || offer.active === false) {
    throw new Error('Cần chọn một offer Worldmove đang hoạt động.');
  }

  if (offer.wmproductId !== variant.wmproductId) {
    throw new Error('Offer Worldmove không khớp chính xác wmproductId của variant.');
  }

  const expectedResolution = resolutionForProviderOffer(offer);
  if (expectedResolution !== resolution) {
    throw new Error('Resolution không phù hợp với loại offer Worldmove đã chọn.');
  }

  if (resolution === 'WORLDMOVE_TOPUP' && product.operation !== 'topup') {
    throw new Error('Không thể xác nhận Top-up cho sản phẩm không có operation topup.');
  }
};
