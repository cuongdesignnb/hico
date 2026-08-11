import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogService } from './catalogService.js';
import { toPublicProduct } from './public/publicProductSerializer.js';

const now = new Date().toISOString();
const products = [
  { id: 'p-ph', slug: 'philippines', name: 'Philippines', operation: 'new_subscription', status: 'active', coverageType: 'country', coverageIds: ['ph'], image: '/uploads/ph.webp', featured: true, seoTitle: 'Philippines', version: 1, createdAt: now, updatedAt: now },
  { id: 'p-draft', slug: 'draft-product', name: 'Draft', operation: 'new_subscription', status: 'draft', coverageType: 'country', coverageIds: ['draft'], version: 1, createdAt: now, updatedAt: now },
];
const variants = [
  { id: 'v-ph', productId: 'p-ph', sku: 'PH-1', price: 100000, compareAtPrice: 120000, currency: 'VND', medium: 'esim', supplier: 'worldmove', fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM', active: true, needsReview: false, archived: false, skuConflict: false, requiresExistingSim: false, providerOfferId: 'private-offer', wmproductId: 'private-provider-id' },
  { id: 'v-draft', productId: 'p-draft', sku: 'DRAFT-1', price: 1, currency: 'VND', medium: 'esim', supplier: 'hico', fulfillmentMethod: 'HICO_MANUAL_QR', active: true, needsReview: false, archived: false, skuConflict: false },
];

test('public catalog exposes only published safe canonical fields', async () => {
  const service = createCatalogService({ readCatalog: async () => ({ products, variants }) });
  const response = await service.listPublicProducts({ paginate: true, filters: { page: '1', pageSize: '10' } });
  assert.equal(response.pagination.total, 1);
  assert.equal(response.items[0].slug, 'philippines');
  assert.equal(response.items[0].variants[0].id, 'v-ph');
  assert.equal('providerOfferId' in response.items[0].variants[0], false);
  assert.equal('wmproductId' in response.items[0].variants[0], false);
  assert.equal(await service.getPublicProductBySlug('unknown'), null);
});

test('public serializer preserves safe media/content and strips private fields recursively', () => {
  const product = toPublicProduct({
    ...products[0],
    images: ['/images/ph.webp'],
    faqItems: [{ question: 'Q?', answer: 'A?' }],
    deviceSpecifications: { brand: 'HICO', model: 'M1', secret: 'drop-me' },
    providerToken: 'drop-me',
  }, [{
    ...variants[0],
    images: ['/uploads/private.webp'],
    shippingRequired: false,
    installationGuide: 'Install',
    deviceSpecifications: { model: 'M1', pin: 'drop-me' },
  }]);
  assert.deepEqual(product.images, ['/uploads/ph.webp', '/images/ph.webp']);
  assert.equal(product.faqItems[0].question, 'Q?');
  assert.equal(product.variants[0].shippingRequired, false);
  assert.equal('providerToken' in product, false);
  assert.equal('providerOfferId' in product.variants[0], false);
  assert.equal('pin' in product.variants[0].deviceSpecifications, false);
});

test('public serializer resolves active MediaAsset references and ignores archived assets', () => {
  const product = toPublicProduct({
    ...products[0],
    primaryMediaId: 'media_primary',
    galleryMediaIds: ['media_gallery', 'media_archived'],
    image: 'https://legacy.example.invalid/image.webp',
  }, [], {
    mediaAssets: [
      { id: 'media_primary', publicUrl: '/uploads/primary.webp', altText: 'Primary' },
      { id: 'media_gallery', publicUrl: '/uploads/gallery.webp', title: 'Gallery' },
      { id: 'media_archived', publicUrl: '/uploads/archived.webp', status: 'ARCHIVED' },
    ],
  });
  assert.equal(product.primaryImage, '/uploads/primary.webp');
  assert.equal(product.primaryMedia.id, 'media_primary');
  assert.deepEqual(product.images, ['/uploads/primary.webp', '/uploads/gallery.webp']);
  assert.equal(product.images.some((url) => url.includes('archived')), false);
  assert.equal(product.images.some((url) => url.startsWith('https://')), false);
});

test('public variants take APN and network from the matched provider offer only', () => {
  const product = toPublicProduct(products[0], [{ ...variants[0], publicNote: 'Đọc trước khi kích hoạt.' }], {
    providerOffers: [{ id: 'private-offer', apnHint: 'hico', networkLabel: 'LTE/5G' }],
  });
  assert.equal(product.variants[0].apn, 'hico');
  assert.equal(product.variants[0].networkLabel, 'LTE/5G');
  assert.equal(product.variants[0].publicNote, 'Đọc trước khi kích hoạt.');
  assert.equal('wmproductId' in product.variants[0], false);
});
