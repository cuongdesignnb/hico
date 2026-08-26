import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeProductInput,
  sanitizeCatalogHtml,
  validateProductRecord,
} from './catalogProductValidation.js';
import {
  normalizeVariantInput,
  validateVariantRecord,
} from './catalogVariantValidation.js';
import {
  getProductPublishReadiness,
  getVariantPublishReadiness,
} from './catalogPublishReadiness.js';

const timestamp = '2026-07-31T00:00:00.000Z';
const product = {
  id: 'product-1',
  name: 'eSIM Nhật Bản',
  slug: 'esim-nhat-ban',
  operation: 'new_subscription',
  categoryId: 'cat-esim-du-lich',
  categoryNeedsReview: false,
  coverageType: 'country',
  coverageIds: ['jp'],
  image: '/images/japan.png',
  featured: false,
  status: 'draft',
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const offer = {
  id: 'worldmove:WM_000123',
  wmproductId: 'WM_000123',
  providerProductType: 0,
  leSIM: true,
  active: true,
};

const variant = (changes = {}) => ({
  id: 'variant-1',
  productId: product.id,
  sku: 'JP-ESIM-10GB-15D',
  dataLimit: '10 GB',
  duration: '15 Ngày',
  price: 280000,
  compareAtPrice: 320000,
  currency: 'VND',
  medium: 'esim',
  supplier: 'hico',
  fulfillmentMethod: 'HICO_MANUAL_QR',
  providerProductType: null,
  leSIM: null,
  requiresExistingSim: false,
  stock: null,
  active: false,
  needsReview: false,
  archived: false,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...changes,
});

test('product input is draft-safe, validates coverage and sanitizes HTML', () => {
  const normalized = normalizeProductInput({
    name: product.name,
    slug: product.slug,
    operation: product.operation,
    coverageType: product.coverageType,
    coverageIds: product.coverageIds,
    image: product.image,
    description: '<p onclick="steal()">Safe<script>alert(1)</script></p>',
  });
  assert.equal(
    normalized.description,
    '<p>Safe</p>',
  );
  assert.equal(validateProductRecord(product).valid, true);
  assert.throws(() => normalizeProductInput({
    name: product.name,
    slug: product.slug,
    operation: product.operation,
    coverageType: product.coverageType,
    coverageIds: ['jp', 'kr'],
  }), /đúng một coverageId/);
  assert.throws(() => normalizeProductInput({
    name: product.name,
    slug: 'eSIM Nhật Bản',
    operation: product.operation,
    coverageType: product.coverageType,
    coverageIds: product.coverageIds,
  }), /Slug phải viết thường/);
  assert.equal(
    sanitizeCatalogHtml('<a href="javascript:alert(1)">x</a>'),
    '<a rel="noopener noreferrer">x</a>',
  );
});

test('variant validates Worldmove leSIM and local carrier mappings', () => {
  const worldmove = variant({
    supplier: 'worldmove',
    fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM',
    providerOfferId: offer.id,
    wmproductId: offer.wmproductId,
    providerProductType: 0,
    leSIM: true,
  });
  assert.equal(validateVariantRecord({
    variant: worldmove,
    product,
    providerOffers: [offer],
  }).valid, true);
  assert.equal(validateVariantRecord({
    variant: { ...worldmove, wmproductId: 'WRONG' },
    product,
    providerOffers: [offer],
  }).valid, false);

  const localOffer = { ...offer, id: 'local:1', leSIM: false };
  const local = variant({
    supplier: 'local_carrier',
    fulfillmentMethod: 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
    providerOfferId: localOffer.id,
    wmproductId: localOffer.wmproductId,
    providerProductType: 0,
    leSIM: false,
  });
  assert.equal(validateVariantRecord({
    variant: local,
    product,
    providerOffers: [localOffer],
  }).valid, true);
});

test('variant validates physical, top-up, manual QR and HICO stock rules', () => {
  const physicalOffer = {
    ...offer,
    id: 'worldmove:physical',
    wmproductId: 'WM_PHYSICAL',
    providerProductType: 1,
    leSIM: null,
  };
  const physical = variant({
    medium: 'physical_sim',
    supplier: 'worldmove',
    fulfillmentMethod: 'WORLDMOVE_PHYSICAL_ORDER',
    providerOfferId: physicalOffer.id,
    wmproductId: physicalOffer.wmproductId,
    providerProductType: 1,
    leSIM: null,
  });
  assert.equal(validateVariantRecord({
    variant: physical,
    product,
    providerOffers: [physicalOffer],
  }).valid, true);

  const topupOffer = {
    ...offer,
    id: 'worldmove:topup',
    wmproductId: 'WM_TOPUP',
    providerProductType: 2,
    leSIM: null,
  };
  const topupProduct = {
    ...product,
    operation: 'topup',
    coverageType: 'not_applicable',
    coverageIds: [],
  };
  const topup = variant({
    productId: topupProduct.id,
    medium: null,
    supplier: 'worldmove',
    fulfillmentMethod: 'WORLDMOVE_TOPUP',
    providerOfferId: topupOffer.id,
    wmproductId: topupOffer.wmproductId,
    providerProductType: 2,
    requiresExistingSim: true,
  });
  assert.equal(validateVariantRecord({
    variant: topup,
    product: topupProduct,
    providerOffers: [topupOffer],
  }).valid, true);
  assert.equal(validateVariantRecord({
    variant: { ...topup, requiresExistingSim: false },
    product: topupProduct,
    providerOffers: [topupOffer],
  }).valid, false);

  assert.equal(validateVariantRecord({
    variant: variant(),
    product,
  }).valid, true);
  assert.equal(validateVariantRecord({
    variant: variant({
      medium: 'physical_sim',
      supplier: 'hico',
      fulfillmentMethod: 'HICO_PHYSICAL_STOCK',
      stock: 0,
    }),
    product,
  }).valid, true);
  assert.throws(() => normalizeVariantInput({
    sku: 'NEGATIVE-STOCK',
    price: 1,
    currency: 'VND',
    medium: 'physical_sim',
    supplier: 'hico',
    fulfillmentMethod: 'HICO_PHYSICAL_STOCK',
    stock: -1,
  }), /stock phải là số nguyên không âm/);
});

test('compare price is a warning and manual processing cannot publish', () => {
  assert.throws(() => normalizeVariantInput({
    sku: 'INVALID-PRICE',
    price: -1,
    currency: 'VND',
    medium: 'esim',
    supplier: 'hico',
    fulfillmentMethod: 'HICO_MANUAL_QR',
  }), /variant.price phải là số hữu hạn không âm/);
  assert.throws(() => normalizeVariantInput({
    sku: 'INVALID-CURRENCY',
    price: 1,
    currency: 'EUR',
    medium: 'esim',
    supplier: 'hico',
    fulfillmentMethod: 'HICO_MANUAL_QR',
  }), /currency chỉ hỗ trợ VND hoặc USD/);

  const compareWarning = validateVariantRecord({
    variant: variant({ compareAtPrice: 100, price: 200 }),
    product,
  });
  assert.equal(compareWarning.valid, true);
  assert.equal(compareWarning.warnings[0].code, 'COMPARE_PRICE_BELOW_PRICE');

  const manual = variant({
    supplier: 'other',
    fulfillmentMethod: 'MANUAL_PROCESSING',
    active: false,
    needsReview: true,
  });
  const readiness = getVariantPublishReadiness({
    variant: manual,
    product,
    products: [product],
    variants: [manual],
    providerOffers: [],
  });
  assert.equal(readiness.publishable, false);
  assert.ok(readiness.errors.some((error) => error.code === 'NEEDS_REVIEW'));
});

test('product readiness requires a publishable variant and blocks SKU conflict', () => {
  const readyVariant = variant();
  const ready = getProductPublishReadiness({
    product,
    products: [product],
    variants: [readyVariant],
    providerOffers: [],
  });
  assert.equal(ready.publishable, true);

  const conflicted = { ...readyVariant, id: 'variant-conflicted' };
  const duplicate = { ...readyVariant, id: 'variant-duplicate' };
  const blocked = getProductPublishReadiness({
    product,
    products: [product],
    variants: [conflicted, duplicate],
    providerOffers: [],
  });
  assert.equal(blocked.publishable, false);
  assert.ok(blocked.errors.some(
    (error) => error.code === 'NO_PUBLISHABLE_VARIANT',
  ));
});
