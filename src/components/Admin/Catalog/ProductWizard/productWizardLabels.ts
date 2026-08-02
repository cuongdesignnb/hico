import type { ProductOperation } from '../../../../types/catalog';
import type { ProviderOffer } from '../../../../types/provider';
import type { VariantDraft, WizardSourceMode } from '../../../../types/productWizard';

export const operationLabels: Record<ProductOperation, string> = {
  new_subscription: 'Mua SIM mới',
  topup: 'Top-up',
  device_sale: 'Thiết bị',
};

export const sourceLabels: Record<WizardSourceMode, string> = {
  worldmove_esim: 'Worldmove eSIM tự động',
  local_esim: 'eSIM nhà mạng địa phương',
  hico_manual_qr: 'QR riêng HICO',
  hico_physical: 'SIM vật lý kho HICO',
  worldmove_physical: 'SIM vật lý Worldmove',
  worldmove_topup: 'Top-up Worldmove',
  manual_processing: 'Xử lý thủ công',
};

export const sourceDescriptions: Record<WizardSourceMode, string> = {
  worldmove_esim: 'Worldmove cấp eSIM redeem tự động.',
  local_esim: 'Đặt eSIM nhà mạng rồi redeem qua Worldmove.',
  hico_manual_qr: 'HICO xử lý QR riêng ngoài provider.',
  hico_physical: 'Xuất SIM vật lý từ kho HICO.',
  worldmove_physical: 'Đặt SIM vật lý qua Worldmove.',
  worldmove_topup: 'Top-up cần SIM đã tồn tại.',
  manual_processing: 'Đơn cần Admin xử lý thủ công và không publish.',
};

export const getCompatibleSources = (operation: ProductOperation): WizardSourceMode[] => {
  if (operation === 'topup') return ['worldmove_topup', 'manual_processing'];
  if (operation === 'device_sale') return ['hico_physical', 'worldmove_physical', 'manual_processing'];
  return [
    'worldmove_esim',
    'local_esim',
    'hico_manual_qr',
    'hico_physical',
    'worldmove_physical',
    'manual_processing',
  ];
};

export const sourceTechnicalFields = (sourceMode: WizardSourceMode) => {
  switch (sourceMode) {
    case 'worldmove_esim':
      return { medium: 'esim' as const, supplier: 'worldmove' as const, providerProductType: 0 as const, leSIM: true, fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM' as const, requiresExistingSim: false };
    case 'local_esim':
      return { medium: 'esim' as const, supplier: 'local_carrier' as const, providerProductType: 0 as const, leSIM: false, fulfillmentMethod: 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM' as const, requiresExistingSim: false };
    case 'hico_manual_qr':
      return { medium: 'esim' as const, supplier: 'hico' as const, providerProductType: null, leSIM: null, fulfillmentMethod: 'HICO_MANUAL_QR' as const, requiresExistingSim: false };
    case 'hico_physical':
      return { medium: 'physical_sim' as const, supplier: 'hico' as const, providerProductType: null, leSIM: null, fulfillmentMethod: 'HICO_PHYSICAL_STOCK' as const, requiresExistingSim: false };
    case 'worldmove_physical':
      return { medium: 'physical_sim' as const, supplier: 'worldmove' as const, providerProductType: 1 as const, leSIM: null, fulfillmentMethod: 'WORLDMOVE_PHYSICAL_ORDER' as const, requiresExistingSim: false };
    case 'worldmove_topup':
      return { medium: null, supplier: 'worldmove' as const, providerProductType: 2 as const, leSIM: null, fulfillmentMethod: 'WORLDMOVE_TOPUP' as const, requiresExistingSim: true };
    case 'manual_processing':
      return { medium: null, supplier: 'other' as const, providerProductType: null, leSIM: null, fulfillmentMethod: 'MANUAL_PROCESSING' as const, requiresExistingSim: false };
  }
};

export const offerMatchesSource = (offer: ProviderOffer, sourceMode: WizardSourceMode) => {
  if (sourceMode === 'worldmove_esim') return offer.providerProductType === 0 && offer.leSIM === true;
  if (sourceMode === 'local_esim') return offer.providerProductType === 0 && offer.leSIM === false;
  if (sourceMode === 'worldmove_physical') return offer.providerProductType === 1;
  if (sourceMode === 'worldmove_topup') return offer.providerProductType === 2;
  return false;
};

export const getVariantSourceLabel = (variant: VariantDraft) => (
  variant.sourceMode ? sourceLabels[variant.sourceMode] : 'Chưa chọn nguồn'
);
