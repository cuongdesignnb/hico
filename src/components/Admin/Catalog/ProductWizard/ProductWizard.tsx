import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCoverageOptions } from '../../../../services/catalogReadApi';
import {
  CatalogWriteApiError,
  createProduct,
  createVariant,
  getProduct,
  getAdminCategories,
  updateProduct,
  updateVariant,
} from '../../../../services/catalogWriteApi';
import type { ProviderOffer } from '../../../../types/provider';
import type { CatalogCategory, CatalogProductRecord } from '../../../../types/catalog';
import type { CoverageOption, ProductDraft, ProductReadinessResult, VariantDraft } from '../../../../types/productWizard';
import { getCatalogSourceStatus } from '../../../../services/catalogWriteApi';
import { getWorldmoveOffers } from '../../../../services/providerApi';
import { useProductReadiness } from '../../../../hooks/catalog/useProductReadiness';
import { getCompatibleSources, sourceTechnicalFields } from './productWizardLabels';
import ConflictAlert from './ConflictAlert';
import ProductCoverageStep from './ProductCoverageStep';
import ProductGeneralStep from './ProductGeneralStep';
import ProductReviewStep from './ProductReviewStep';
import ProductCategoryStep from './ProductCategoryStep';
import ProductVariantsStep from './ProductVariantsStep';
import ProductWizardFooter from './ProductWizardFooter';
import ProductWizardHeader from './ProductWizardHeader';
import ProductWizardStepper from './ProductWizardStepper';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import VersionConflictDialog from './VersionConflictDialog';
import { useProductWizard } from '../../../../hooks/catalog/useProductWizard';
import './ProductWizard.css';

interface ProductWizardProps {
  mode: 'create' | 'edit';
  productId?: string;
  cloneProductId?: string;
  initialCategoryId?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface LoadedWizardData {
  catalogVersionId: string;
  product?: CatalogProductRecord;
  categories: CatalogCategory[];
}

const makeSlug = (value: string) => value
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const hashPayload = (value: unknown) => {
  const input = JSON.stringify(value);
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) hash = ((hash * 33) ^ input.charCodeAt(index)) >>> 0;
  return hash.toString(16);
};

const makeIdempotencyKey = (sessionId: string, operation: string, entityId: string, payload: unknown) => (
  `${sessionId}:${operation}:${entityId}:${hashPayload(payload)}`
);

const buildProductPayload = (product: ProductDraft) => ({
  name: product.name.trim(),
  slug: product.slug.trim(),
  categoryId: product.categoryId,
  categoryNeedsReview: false,
  operation: product.operation,
  coverageType: product.coverageType,
  coverageIds: product.coverageIds,
  image: product.primaryMediaId ? undefined : product.image.trim() || undefined,
  primaryMediaId: product.primaryMediaId || undefined,
  gallery: product.galleryMediaIds.length ? undefined : product.gallery.length ? product.gallery : undefined,
  galleryMediaIds: product.galleryMediaIds.length ? product.galleryMediaIds : undefined,
  description: product.description.trim() || undefined,
  guide: product.guide.trim() || undefined,
  featured: product.featured,
  seoTitle: product.seoTitle.trim() || undefined,
  seoDescription: product.seoDescription.trim() || undefined,
  seoKeywords: product.seoKeywords.trim() || undefined,
  deviceSpecifications: product.deviceSpecifications,
  networkLabel: product.networkLabel.trim() || undefined,
  coverageLabel: product.coverageLabel.trim() || undefined,
  speedLabel: product.speedLabel.trim() || undefined,
  installationGuide: product.installationGuide.trim() || undefined,
  compatibilityContent: product.compatibilityContent.trim() || undefined,
  instructions: product.instructions.trim() || undefined,
  eligibilityNote: product.eligibilityNote.trim() || undefined,
  packageContents: product.packageContents.trim() || undefined,
  deliveryNote: product.deliveryNote.trim() || undefined,
  simSize: product.simSize.trim() || undefined,
  faqItems: product.faqItems.length ? product.faqItems : undefined,
});

const buildVariantPayload = (variant: VariantDraft) => {
  const source = variant.sourceMode ? sourceTechnicalFields(variant.sourceMode) : null;
  return {
    sku: variant.sku.trim(),
    dataLimit: variant.dataLimit.trim() || undefined,
    duration: variant.duration.trim() || undefined,
    price: Number(variant.price),
    compareAtPrice: variant.compareAtPrice.trim() === '' ? null : Number(variant.compareAtPrice),
    currency: variant.currency,
    medium: source?.medium ?? variant.medium ?? null,
    supplier: source?.supplier ?? variant.supplier ?? 'other',
    fulfillmentMethod: source?.fulfillmentMethod ?? variant.fulfillmentMethod,
    providerOfferId: variant.providerOfferId,
    wmproductId: variant.wmproductId,
    providerProductId: variant.providerProductId,
    providerProductType: source?.providerProductType ?? variant.providerProductType ?? null,
    leSIM: source?.leSIM ?? variant.leSIM ?? null,
    requiresExistingSim: source?.requiresExistingSim ?? variant.requiresExistingSim,
    shippingRequired: source?.fulfillmentMethod === 'WORLDMOVE_PHYSICAL_ORDER' || variant.shippingRequired,
    networkLabel: variant.networkLabel,
    coverageLabel: variant.coverageLabel,
    speedLabel: variant.speedLabel,
    installationGuide: variant.installationGuide,
    compatibilityContent: variant.compatibilityContent,
    instructions: variant.instructions,
    eligibilityNote: variant.eligibilityNote,
    packageContents: variant.packageContents,
    deliveryNote: variant.deliveryNote,
    simSize: variant.simSize,
    deviceSpecifications: variant.deviceSpecifications,
    stock: source?.fulfillmentMethod === 'HICO_PHYSICAL_STOCK' ? Number(variant.stock) : null,
    active: source?.fulfillmentMethod === 'MANUAL_PROCESSING' ? false : variant.active,
    needsReview: source?.fulfillmentMethod === 'MANUAL_PROCESSING' ? true : variant.needsReview,
  };
};

const validateWizard = (product: ProductDraft, variants: VariantDraft[], categoryKind?: CatalogCategory['kind']) => {
  const errors: Array<{ step: number; field?: string; message: string }> = [];
  const warnings: Array<{ step: number; field?: string; message: string }> = [];
  if (!product.categoryId) errors.push({ step: 1, field: 'categoryId', message: 'Hãy chọn một danh mục con.' });
  if (!product.name.trim()) errors.push({ step: 2, field: 'name', message: 'Tên sản phẩm là bắt buộc.' });
  if (!product.slug.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug.trim())) errors.push({ step: 2, field: 'slug', message: 'Slug chỉ dùng chữ thường, số và dấu gạch ngang.' });
  if (product.coverageType === 'country' && product.coverageIds.length !== 1) errors.push({ step: 2, field: 'coverageIds', message: 'Coverage quốc gia phải chọn đúng một quốc gia.' });
  if (product.coverageType === 'region' && product.coverageIds.length === 0) errors.push({ step: 2, field: 'coverageIds', message: 'Coverage khu vực cần ít nhất một lựa chọn.' });
  if (product.coverageType === 'global' && product.coverageIds[0] !== 'global') errors.push({ step: 2, field: 'coverageIds', message: 'Coverage toàn cầu phải dùng mã global.' });
  if (variants.length === 0) errors.push({ step: 3, message: 'Sản phẩm cần ít nhất một variant.' });
  const skuSet = new Set<string>();
  variants.forEach((variant, index) => {
    const row = index + 1;
    if (!variant.sku.trim()) errors.push({ step: 3, field: `variant-${variant.tempId}-sku`, message: `Gói ${row} cần SKU.` });
    if (skuSet.has(variant.sku.trim())) errors.push({ step: 3, field: `variant-${variant.tempId}-sku`, message: `SKU của gói ${row} bị trùng trong wizard.` });
    skuSet.add(variant.sku.trim());
    if (variant.price.trim() === '' || Number.isNaN(Number(variant.price)) || Number(variant.price) < 0) errors.push({ step: 3, message: `Giá bán của gói ${row} không hợp lệ.` });
    if (!variant.sourceMode) errors.push({ step: 3, message: `Gói ${row} chưa chọn nguồn cấp.` });
    if (variant.sourceMode && !getCompatibleSources(product.operation, categoryKind).includes(variant.sourceMode)) errors.push({ step: 3, message: `Nguồn cấp của gói ${row} không khớp danh mục đã chọn.` });
    if (variant.sourceMode === 'hico_physical' && (!/^\d+$/.test(variant.stock) || Number(variant.stock) < 0)) errors.push({ step: 3, message: `Tồn kho của gói ${row} phải là số nguyên không âm.` });
    if (variant.sourceMode && ['worldmove_esim', 'local_esim', 'worldmove_physical', 'worldmove_topup'].includes(variant.sourceMode) && !variant.providerOfferId) errors.push({ step: 3, message: `Gói ${row} cần chọn Provider Offer active.` });
    if (variant.compareAtPrice && Number(variant.compareAtPrice) < Number(variant.price)) warnings.push({ step: 3, message: `Giá so sánh của gói ${row} thấp hơn giá bán.` });
    if (variant.sourceMode === 'manual_processing') warnings.push({ step: 3, message: `Gói ${row} là xử lý thủ công và sẽ không publishable.` });
  });
  return { errors, warnings };
};

const ProductWizardBody = ({ data, mode, initialCategoryId, onClose, onSaved }: { data: LoadedWizardData; mode: 'create' | 'edit'; initialCategoryId?: string; onClose: () => void; onSaved: () => void }) => {
  const wizard = useProductWizard({ mode, catalogVersionId: data.catalogVersionId, product: data.product, initialCategoryId });
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [coverageOptions, setCoverageOptions] = useState<CoverageOption[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const { readiness, loading: readinessLoading, checkReadiness } = useProductReadiness();
  const selectedCategory = data.categories.find((category) => category.id === wizard.state.product.categoryId);

  useEffect(() => {
    const controller = new AbortController();
    getWorldmoveOffers(controller.signal).then(setOffers).catch(() => setOffers([])).finally(() => { if (!controller.signal.aborted) setOffersLoading(false); });
    getCoverageOptions(controller.signal).then(setCoverageOptions).catch(() => setCoverageOptions([])).finally(() => { if (!controller.signal.aborted) setCoverageLoading(false); });
    return () => controller.abort();
  }, []);

  const requestClose = () => {
    if (wizard.state.dirty) setShowUnsaved(true);
    else onClose();
  };

  const validateAndMove = (nextStep: number) => {
    const targetStep = Math.min(nextStep, wizard.state.step + 1);
    if (targetStep <= wizard.state.step) {
      wizard.setStep(targetStep);
      return;
    }

    const validation = validateWizard(wizard.state.product, wizard.state.variants, selectedCategory?.kind);
    wizard.setValidation(validation.errors, validation.warnings);
    const blocked = validation.errors.some((error) => error.step <= wizard.state.step);
    if (!blocked) wizard.setStep(targetStep);
  };

  const save = async () => {
    const validation = validateWizard(wizard.state.product, wizard.state.variants, selectedCategory?.kind);
    wizard.setValidation(validation.errors, validation.warnings);
    if (validation.errors.length > 0 || !wizard.state.catalogVersionId) return;
    wizard.markSaving(true);
    let productId = wizard.state.productId;
    let productVersion = wizard.state.productVersion;
    let catalogVersionId = wizard.state.catalogVersionId;
    try {
      const productPayload = buildProductPayload(wizard.state.product);
      if (productId && productVersion !== undefined) {
        const response = await updateProduct(productId, { idempotencyKey: makeIdempotencyKey(wizard.state.sessionId, 'update-product', productId, productPayload), catalogVersionId, version: productVersion, changes: productPayload });
        productVersion = response.product?.version ?? productVersion + 1;
        catalogVersionId = response.catalogVersionId;
      } else {
        const response = await createProduct({ idempotencyKey: makeIdempotencyKey(wizard.state.sessionId, 'create-product', 'product', productPayload), catalogVersionId, product: productPayload });
        productId = response.product?.id;
        productVersion = response.product?.version;
        catalogVersionId = response.catalogVersionId;
      }
      if (!productId) throw new Error('Backend chưa trả về product ID.');
      wizard.applySaveResult({ productId, productVersion, catalogVersionId, dirty: false, lastError: '' });
      for (const variant of wizard.state.variants) {
        const variantPayload = buildVariantPayload(variant);
        if (variant.id && variant.version !== undefined) {
          const response = await updateVariant(productId, variant.id, { idempotencyKey: makeIdempotencyKey(wizard.state.sessionId, 'update-variant', variant.id, variantPayload), catalogVersionId, version: variant.version, changes: variantPayload });
          catalogVersionId = response.catalogVersionId;
          wizard.updateVariant(variant.tempId, { version: response.variant?.version ?? variant.version + 1, saved: true });
        } else {
          const response = await createVariant(productId, { idempotencyKey: makeIdempotencyKey(wizard.state.sessionId, 'create-variant', variant.tempId, variantPayload), catalogVersionId, variant: variantPayload });
          catalogVersionId = response.catalogVersionId;
          wizard.updateVariant(variant.tempId, { id: response.variant?.id, version: response.variant?.version, saved: true });
        }
        wizard.applySaveResult({ catalogVersionId });
      }
      wizard.applySaveResult({ dirty: false, saving: false, catalogVersionId });
      onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu bản nháp.';
      wizard.applySaveResult({ saving: false, lastError: message, productId, productVersion, catalogVersionId, dirty: true });
      if (error instanceof CatalogWriteApiError && error.status === 409) setConflictMessage(message);
    }
  };

  const reloadAfterConflict = async () => {
    if (!wizard.state.productId) return;
    try {
      const [fresh, sourceStatus] = await Promise.all([getProduct(wizard.state.productId), getCatalogSourceStatus()]);
      wizard.resetFromProduct({ ...fresh.product, variants: fresh.variants }, sourceStatus.canonicalVersion || fresh.catalogVersionId);
      setConflictMessage('');
    } catch (error) {
      wizard.applySaveResult({ lastError: error instanceof Error ? error.message : 'Không thể tải lại dữ liệu.' });
    }
  };

  const applySourceToAll = (sourceMode: VariantDraft['sourceMode']) => {
    if (!sourceMode) return;
    for (const variant of wizard.state.variants) {
      wizard.updateVariant(variant.tempId, { sourceMode, providerOfferId: undefined, wmproductId: undefined, providerProductId: undefined, providerProductType: undefined, leSIM: undefined });
    }
  };

  const content = wizard.state.step === 1
    ? <ProductCategoryStep categories={data.categories} categoryId={wizard.state.product.categoryId} onChange={(categoryId, operation) => wizard.updateProduct({ categoryId, operation })} />
    : wizard.state.step === 2
      ? <><ProductGeneralStep product={wizard.state.product} onChange={wizard.updateProduct} onGenerateSlug={() => wizard.updateProduct({ slug: makeSlug(wizard.state.product.name) })} /><ProductCoverageStep product={wizard.state.product} options={coverageOptions} loading={coverageLoading} onChange={wizard.updateProduct} /></>
      : wizard.state.step === 3
        ? <ProductVariantsStep operation={wizard.state.product.operation} categoryKind={selectedCategory?.kind} variants={wizard.state.variants} offers={offers} offersLoading={offersLoading} onAdd={wizard.addVariant} onAddProviderOffers={wizard.addProviderOffers} onApplySource={applySourceToAll} onUpdate={wizard.updateVariant} onDuplicate={wizard.duplicateVariant} onRemove={wizard.removeVariant} />
        : <ProductReviewStep state={wizard.state} readiness={readiness as ProductReadinessResult | null} readinessLoading={readinessLoading} onCheckReadiness={() => { if (wizard.state.productId) void checkReadiness(wizard.state.productId); }} />;

  return (
    <div className="product-wizard-backdrop" role="presentation">
      <section className="product-wizard-modal" role="dialog" aria-modal="true" aria-labelledby="product-wizard-title">
        <ProductWizardHeader mode={mode} productName={wizard.state.product.name} onClose={requestClose} />
        <h1 id="product-wizard-title" className="product-wizard-visually-hidden">Product Wizard</h1>
        <ProductWizardStepper step={wizard.state.step} onStepClick={validateAndMove} />
        {wizard.state.lastError && <ConflictAlert message={wizard.state.lastError} onDismiss={() => wizard.applySaveResult({ lastError: '' })} />}
        <main className="product-wizard-body">{content}</main>
        <ProductWizardFooter step={wizard.state.step} saving={wizard.state.saving} dirty={wizard.state.dirty} onBack={() => wizard.setStep(wizard.state.step - 1)} onNext={() => validateAndMove(wizard.state.step + 1)} onSave={() => void save()} />
        {showUnsaved && <UnsavedChangesDialog onContinue={() => setShowUnsaved(false)} onDiscard={onClose} />}
        {conflictMessage && <VersionConflictDialog message={conflictMessage} onReload={() => void reloadAfterConflict()} onCancel={() => setConflictMessage('')} />}
      </section>
    </div>
  );
};

const ProductWizard = ({ mode, productId, cloneProductId, initialCategoryId, onClose, onSaved }: ProductWizardProps) => {
  const [data, setData] = useState<LoadedWizardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getCatalogSourceStatus(),
      getAdminCategories(controller.signal),
      (mode === 'edit' && productId) || cloneProductId ? getProduct((mode === 'edit' ? productId : cloneProductId) as string, controller.signal) : Promise.resolve(null),
    ]).then(([sourceStatus, categoryResponse, productResponse]) => {
      if (!sourceStatus.canonicalVersion) throw new Error('Canonical catalog chưa sẵn sàng để ghi.');
      const product = productResponse ? { ...productResponse.product, variants: productResponse.variants } : undefined;
      setData({ catalogVersionId: sourceStatus.canonicalVersion, product, categories: categoryResponse.items });
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Không thể mở Product Wizard.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [cloneProductId, mode, productId]);

  if (loading) return <div className="product-wizard-backdrop" role="status"><div className="product-wizard-loading"><LoaderCircle className="catalog-spinner" size={24} /> Đang tải Product Wizard...</div></div>;
  if (error || !data) return <div className="product-wizard-backdrop" role="presentation"><div className="product-wizard-loading product-wizard-loading-error"><AlertCircle size={22} /><strong>{error || 'Không có dữ liệu Product Wizard.'}</strong><button type="button" className="product-wizard-secondary-button" onClick={onClose}>Đóng</button></div></div>;
  return <ProductWizardBody key={`${mode}-${data.product?.id || 'new'}`} data={data} mode={mode} initialCategoryId={initialCategoryId} onClose={onClose} onSaved={onSaved} />;
};

export default ProductWizard;
