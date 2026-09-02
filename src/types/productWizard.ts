import type {
  CatalogDeviceSpecs,
  CatalogProduct,
  CatalogProductRecord,
  CatalogVariant,
  CoverageType,
  ProductOperation,
} from './catalog';

export type WizardMode = 'create' | 'edit';

export type WizardSourceMode =
  | 'worldmove_esim'
  | 'local_esim'
  | 'hico_manual_qr'
  | 'hico_physical'
  | 'worldmove_physical'
  | 'worldmove_topup'
  | 'manual_processing';

export interface CoverageOption {
  id: string;
  name: string;
  flag?: string;
  region?: string;
  isoCode?: string;
}

export interface ProductDraft {
  name: string;
  slug: string;
  categoryId: string;
  operation: ProductOperation;
  coverageType: CoverageType;
  coverageIds: string[];
  image: string;
  primaryMediaId: string | null;
  gallery: NonNullable<CatalogProduct['gallery']>;
  galleryMediaIds: string[];
  description: string;
  guide: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  deviceSpecifications?: CatalogDeviceSpecs;
  networkLabel: string;
  coverageLabel: string;
  speedLabel: string;
  installationGuide: string;
  compatibilityContent: string;
  instructions: string;
  eligibilityNote: string;
  packageContents: string;
  deliveryNote: string;
  simSize: string;
  faqItems: NonNullable<CatalogProduct['faqItems']>;
}

export interface VariantDraft {
  tempId: string;
  id?: string;
  version?: number;
  sku: string;
  dataLimit: string;
  duration: string;
  price: string;
  compareAtPrice: string;
  currency: 'VND' | 'USD';
  sourceMode?: WizardSourceMode;
  providerOfferId?: string;
  wmproductId?: string;
  providerProductId?: string;
  providerProductType?: 0 | 1 | 2 | null;
  leSIM?: boolean | null;
  medium?: 'esim' | 'physical_sim' | null;
  supplier?: 'worldmove' | 'local_carrier' | 'hico' | 'other';
  fulfillmentMethod?: CatalogVariant['fulfillmentMethod'];
  requiresExistingSim: boolean;
  shippingRequired?: boolean;
  networkLabel?: string;
  coverageLabel?: string;
  speedLabel?: string;
  installationGuide?: string;
  compatibilityContent?: string;
  instructions?: string;
  eligibilityNote?: string;
  packageContents?: string;
  deliveryNote?: string;
  simSize?: string;
  deviceSpecifications?: CatalogDeviceSpecs;
  stock: string;
  active: boolean;
  needsReview: boolean;
  archived?: boolean;
  saved?: boolean;
  hotspotSupport?: string; // 'true'=yes, 'false'=no, undefined=unset
  activationPolicy?: string;
}

export interface WizardValidationError {
  field?: string;
  step: number;
  message: string;
  code?: string;
}

export interface WizardValidationWarning {
  field?: string;
  step: number;
  message: string;
  code?: string;
}

export interface ProductReadinessResult {
  productId: string;
  publishable: boolean;
  errors: Array<{ code?: string; message: string }>;
  warnings: Array<{ code?: string; message: string }>;
  variants?: Array<{
    variantId: string;
    publishable: boolean;
    errors: Array<{ code?: string; message: string }>;
    warnings: Array<{ code?: string; message: string }>;
  }>;
  catalogVersionId: string;
}

export interface CatalogSourceStatus {
  readSource: 'legacy' | 'canonical';
  legacyWriteEnabled: boolean;
  canonicalVersion: string | null;
  canonicalChecksum: string | null;
  rollbackAvailable: boolean;
}

export interface ProductWizardState {
  mode: WizardMode;
  step: number;
  product: ProductDraft;
  variants: VariantDraft[];
  productId?: string;
  productVersion?: number;
  catalogVersionId: string;
  dirty: boolean;
  saving: boolean;
  validationErrors: WizardValidationError[];
  validationWarnings: WizardValidationWarning[];
  lastError: string;
  sessionId: string;
}

export interface ProductWizardInput {
  mode: WizardMode;
  catalogVersionId: string;
  product?: CatalogProductRecord;
  initialCategoryId?: string;
}

export type ProductDraftChanges = Partial<Omit<CatalogProduct, 'id' | 'version' | 'createdAt' | 'updatedAt'>>;
