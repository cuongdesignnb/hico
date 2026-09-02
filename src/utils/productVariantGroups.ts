import type { PublicProduct, PublicVariant } from '../types/publicCatalog';

export type SimTypeKey = 'esim_api' | 'lesim_auto' | 'esim_manual' | 'physical_sim';

export interface SimTypeDescriptor {
  key: SimTypeKey;
  label: string;
  shortLabel: string;
  description: string;
  matches: (variant: PublicVariant) => boolean;
}

const isWorldmoveRedeem = (variant: PublicVariant) =>
  variant.fulfillmentMethod === 'WORLDMOVE_ESIM_REDEEM';

const isWorldmoveOrderThenRedeem = (variant: PublicVariant) =>
  variant.fulfillmentMethod === 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM';

const isManualQr = (variant: PublicVariant) =>
  variant.fulfillmentMethod === 'HICO_MANUAL_QR';

const isPhysical = (variant: PublicVariant) =>
  variant.fulfillmentMethod === 'HICO_PHYSICAL_STOCK'
  || variant.fulfillmentMethod === 'WORLDMOVE_PHYSICAL_ORDER';

export const SIM_TYPE_DESCRIPTORS: SimTypeDescriptor[] = [
  {
    key: 'esim_api',
    label: 'eSIM API',
    shortLabel: 'eSIM API',
    description: 'Tự động quét QR và nhận gói ngay khi thanh toán.',
    matches: isWorldmoveRedeem,
  },
  {
    key: 'lesim_auto',
    label: 'leSIM tự động',
    shortLabel: 'leSIM',
    description: 'Nhận mã QR qua email ngay sau khi đặt cọc.',
    matches: isWorldmoveOrderThenRedeem,
  },
  {
    key: 'esim_manual',
    label: 'eSIM Thủ Công',
    shortLabel: 'eSIM thủ công',
    description: 'Đội ngũ HICO cấp mã QR thủ công qua email.',
    matches: isManualQr,
  },
  {
    key: 'physical_sim',
    label: 'SIM Vật Lý',
    shortLabel: 'SIM vật lý',
    description: 'Giao hàng tận nơi theo địa chỉ khách hàng.',
    matches: isPhysical,
  },
];

export const simTypeForVariant = (variant: PublicVariant): SimTypeKey | null => {
  for (const descriptor of SIM_TYPE_DESCRIPTORS) {
    if (descriptor.matches(variant)) return descriptor.key;
  }
  return null;
};

export const availableSimTypes = (product: PublicProduct): SimTypeDescriptor[] => {
  if (!product.variants?.length) return [];
  return SIM_TYPE_DESCRIPTORS.filter((descriptor) =>
    product.variants.some((variant) => descriptor.matches(variant)),
  );
};

export const groupVariantsBySimType = (
  product: PublicProduct,
): Record<SimTypeKey, PublicVariant[]> => {
  const groups: Record<SimTypeKey, PublicVariant[]> = {
    esim_api: [],
    lesim_auto: [],
    esim_manual: [],
    physical_sim: [],
  };
  for (const variant of product.variants ?? []) {
    const key = simTypeForVariant(variant);
    if (key) groups[key].push(variant);
  }
  return groups;
};

export interface VariantSelection {
  simType: SimTypeKey | null;
  dataLimit: string | null;
  duration: string | null;
}

export const resolveVariantId = (
  product: PublicProduct,
  selection: VariantSelection,
): string | null => {
  if (!product.variants?.length) return null;

  const candidates = selection.simType
    ? product.variants.filter((variant) => simTypeForVariant(variant) === selection.simType)
    : product.variants;

  if (candidates.length === 0) return null;

  const exactMatch = candidates.find((variant) => {
    const matchesData = !selection.dataLimit || variant.dataLimit === selection.dataLimit;
    const matchesDuration = !selection.duration || variant.duration === selection.duration;
    return matchesData && matchesDuration;
  });
  if (exactMatch) return exactMatch.id;

  const partialByData = candidates.find((variant) => (
    !selection.dataLimit || variant.dataLimit === selection.dataLimit
  ));
  if (partialByData) return partialByData.id;

  const partialByDuration = candidates.find((variant) => (
    !selection.duration || variant.duration === selection.duration
  ));
  if (partialByDuration) return partialByDuration.id;

  return candidates[0]?.id ?? null;
};

export const uniqueDataLimits = (product: PublicProduct, simType: SimTypeKey | null): string[] => {
  const pool = simType
    ? groupVariantsBySimType(product)[simType]
    : product.variants ?? [];
  return [...new Set(pool.map((variant) => variant.dataLimit).filter((value): value is string => Boolean(value)))];
};

// Note: dataLimit param kept for API parity but NOT used for filtering.
// Duration is independent of dataLimit in this product model.
export const uniqueDurations = (
  product: PublicProduct,
  simType: SimTypeKey | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API parity
  _dataLimit: string | null,
): string[] => {
  const pool = simType
    ? groupVariantsBySimType(product)[simType]
    : product.variants ?? [];
  return [...new Set(pool.map((variant) => variant.duration).filter((value): value is string => Boolean(value)))];
};

// Note: dataLimit param kept for API parity but NOT used for compatibility check.
// Duration is independent of dataLimit in this product model.
export const isDurationCompatible = (
  product: PublicProduct,
  simType: SimTypeKey | null,
  _dataLimit: string | null,
  duration: string,
): boolean => {
  void _dataLimit; // API parity — not used
  const pool = simType
    ? groupVariantsBySimType(product)[simType]
    : product.variants ?? [];
  return pool.some((variant) => variant.duration === duration);
};
