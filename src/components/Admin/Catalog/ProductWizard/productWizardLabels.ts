import type { CatalogCategoryKind, ProductOperation } from '../../../../types/catalog';
import type { ProviderOffer } from '../../../../types/provider';
import type { VariantDraft, WizardSourceMode } from '../../../../types/productWizard';

export const operationLabels: Record<ProductOperation, string> = {
  new_subscription: 'Mua SIM mới',
  topup: 'Top-up',
  device_sale: 'Thiết bị',
};

export const sourceLabels: Record<WizardSourceMode, string> = {
  worldmove_esim: 'Worldmove eSIM tự động',
  hico_manual_qr: 'QR riêng HICO',
  hico_physical: 'Kho HICO',
  manual_processing: 'Xử lý thủ công',
};

export const sourceDescriptions: Record<WizardSourceMode, string> = {
  worldmove_esim: 'Worldmove cấp eSIM theo provider product type 0.',
  hico_manual_qr: 'HICO xử lý QR riêng ngoài provider.',
  hico_physical: 'Xuất SIM hoặc thiết bị từ kho HICO.',
  manual_processing: 'Đơn cần Admin xử lý thủ công và không publish.',
};

export const getCompatibleSources = (operation: ProductOperation, categoryKind?: CatalogCategoryKind | null): WizardSourceMode[] => {
  if (categoryKind === 'esim') return ['worldmove_esim', 'hico_manual_qr', 'manual_processing'];
  if (categoryKind === 'physical_sim') return ['hico_physical', 'manual_processing'];
  if (categoryKind === 'topup') return [];
  if (categoryKind === 'device' || categoryKind === 'accessory') return ['hico_physical', 'manual_processing'];
  if (operation === 'topup') return [];
  if (operation === 'device_sale') return ['hico_physical', 'manual_processing'];
  return [
    'worldmove_esim',
    'hico_manual_qr',
    'hico_physical',
    'manual_processing',
  ];
};

export const sourceTechnicalFields = (sourceMode: WizardSourceMode, leSIM = true) => {
  switch (sourceMode) {
    case 'worldmove_esim':
      return { medium: 'esim' as const, supplier: 'worldmove' as const, providerProductType: 0 as const, leSIM, fulfillmentMethod: leSIM === false ? 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM' as const : 'WORLDMOVE_ESIM_REDEEM' as const, requiresExistingSim: false };
    case 'hico_manual_qr':
      return { medium: 'esim' as const, supplier: 'hico' as const, providerProductType: null, leSIM: null, fulfillmentMethod: 'HICO_MANUAL_QR' as const, requiresExistingSim: false };
    case 'hico_physical':
      return { medium: 'physical_sim' as const, supplier: 'hico' as const, providerProductType: null, leSIM: null, fulfillmentMethod: 'HICO_PHYSICAL_STOCK' as const, requiresExistingSim: false };
    case 'manual_processing':
      return { medium: null, supplier: 'other' as const, providerProductType: null, leSIM: null, fulfillmentMethod: 'MANUAL_PROCESSING' as const, requiresExistingSim: false };
  }
};

export const offerMatchesSource = (offer: ProviderOffer, sourceMode: WizardSourceMode) => {
  return sourceMode === 'worldmove_esim'
    && offer.provider === 'worldmove'
    && offer.providerProductType === 0
    && typeof offer.leSIM === 'boolean';
};

export const getVariantSourceLabel = (variant: VariantDraft) => (
  variant.sourceMode ? sourceLabels[variant.sourceMode] : 'Chưa chọn nguồn'
);
