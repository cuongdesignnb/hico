import { useCallback, useMemo, useState } from 'react';
import type { CatalogProductRecord, CatalogVariant } from '../../types/catalog';
import type {
  ProductDraft,
  ProductWizardInput,
  ProductWizardState,
  VariantDraft,
  WizardSourceMode,
} from '../../types/productWizard';
import { createProductDraft } from './useProductDraft';

const createTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sourceFromVariant = (variant: CatalogVariant): WizardSourceMode | undefined => {
  if (variant.fulfillmentMethod === 'WORLDMOVE_ESIM_REDEEM') return 'worldmove_esim';
  if (variant.fulfillmentMethod === 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM') return 'local_esim';
  if (variant.fulfillmentMethod === 'HICO_MANUAL_QR') return 'hico_manual_qr';
  if (variant.fulfillmentMethod === 'HICO_PHYSICAL_STOCK') return 'hico_physical';
  if (variant.fulfillmentMethod === 'WORLDMOVE_PHYSICAL_ORDER') return 'worldmove_physical';
  if (variant.fulfillmentMethod === 'WORLDMOVE_TOPUP') return 'worldmove_topup';
  if (variant.fulfillmentMethod === 'MANUAL_PROCESSING') return 'manual_processing';
  return undefined;
};

export const variantToDraft = (variant: CatalogVariant): VariantDraft => ({
  tempId: variant.id,
  id: variant.id,
  version: variant.version,
  sku: variant.sku,
  dataLimit: variant.dataLimit ?? '',
  duration: variant.duration ?? '',
  price: String(variant.price),
  compareAtPrice: variant.compareAtPrice === null || variant.compareAtPrice === undefined ? '' : String(variant.compareAtPrice),
  currency: variant.currency,
  sourceMode: sourceFromVariant(variant),
  providerOfferId: variant.providerOfferId,
  wmproductId: variant.wmproductId,
  providerProductType: variant.providerProductType,
  leSIM: variant.leSIM,
  medium: variant.medium,
  supplier: variant.supplier,
  fulfillmentMethod: variant.fulfillmentMethod,
  requiresExistingSim: variant.requiresExistingSim,
  stock: variant.stock === null || variant.stock === undefined ? '' : String(variant.stock),
  active: variant.active,
  needsReview: variant.needsReview ?? false,
  archived: Boolean(variant.archived),
  saved: true,
  // Public content metadata
  networkLabel: variant.networkLabel,
  activationPolicy: variant.activationPolicy,
  hotspotSupport: variant.hotspotSupport,
});

const createInitialState = ({ mode, catalogVersionId, product }: ProductWizardInput): ProductWizardState => ({
  mode,
  step: 1,
  product: createProductDraft(product),
  variants: product?.variants.map(variantToDraft) ?? [],
  productId: product?.id,
  productVersion: product?.version,
  catalogVersionId,
  dirty: false,
  saving: false,
  validationErrors: [],
  validationWarnings: [],
  lastError: '',
  sessionId: `wizard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
});

export const useProductWizard = (input: ProductWizardInput) => {
  const [state, setState] = useState(() => createInitialState(input));
  const [initialProduct] = useState<CatalogProductRecord | undefined>(input.product);

  const updateProduct = useCallback((changes: Partial<ProductDraft>) => {
    setState((current) => ({ ...current, product: { ...current.product, ...changes }, dirty: true, lastError: '' }));
  }, []);

  const updateVariant = useCallback((tempId: string, changes: Partial<VariantDraft>) => {
    setState((current) => ({
      ...current,
      variants: current.variants.map((variant) => variant.tempId === tempId ? { ...variant, ...changes } : variant),
      dirty: true,
      lastError: '',
    }));
  }, []);

  const addVariant = useCallback(() => {
    setState((current) => ({
      ...current,
      variants: [...current.variants, {
        tempId: createTempId(),
        sku: '',
        dataLimit: '',
        duration: '',
        price: '',
        compareAtPrice: '',
        currency: 'VND',
        requiresExistingSim: false,
        stock: '',
        active: false,
        needsReview: false,
        saved: false,
      }],
      dirty: true,
    }));
  }, []);

  const duplicateVariant = useCallback((tempId: string) => {
    setState((current) => {
      const source = current.variants.find((variant) => variant.tempId === tempId);
      if (!source) return current;
      return {
        ...current,
        variants: [...current.variants, { ...source, tempId: createTempId(), id: undefined, version: undefined, saved: false, sku: `${source.sku}-COPY` }],
        dirty: true,
      };
    });
  }, []);

  const removeVariant = useCallback((tempId: string) => {
    setState((current) => ({ ...current, variants: current.variants.filter((variant) => variant.tempId !== tempId), dirty: true }));
  }, []);

  const setStep = useCallback((step: number) => {
    setState((current) => ({ ...current, step: Math.min(5, Math.max(1, step)) }));
  }, []);

  const setValidation = useCallback((validationErrors: ProductWizardState['validationErrors'], validationWarnings: ProductWizardState['validationWarnings']) => {
    setState((current) => ({ ...current, validationErrors, validationWarnings }));
  }, []);

  const markSaving = useCallback((saving: boolean) => {
    setState((current) => ({ ...current, saving }));
  }, []);

  const applySaveResult = useCallback((changes: Partial<ProductWizardState>) => {
    setState((current) => ({ ...current, ...changes }));
  }, []);

  const resetFromProduct = useCallback((product: CatalogProductRecord, catalogVersionId: string) => {
    setState((current) => ({
      ...current,
      product: createProductDraft(product),
      variants: product.variants.map(variantToDraft),
      productId: product.id,
      productVersion: product.version,
      catalogVersionId,
      dirty: false,
      lastError: '',
      validationErrors: [],
      validationWarnings: [],
    }));
  }, []);

  const derived = useMemo(() => ({
    initialProduct,
    hasVariants: state.variants.length > 0,
    hasUnsavedVariants: state.variants.some((variant) => !variant.saved),
  }), [initialProduct, state.variants]);

  return {
    state,
    updateProduct,
    updateVariant,
    addVariant,
    duplicateVariant,
    removeVariant,
    setStep,
    setValidation,
    markSaving,
    applySaveResult,
    resetFromProduct,
    ...derived,
  };
};
