import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { createCatalogAuditRepository } from './catalogAuditRepository.js';
import { createCatalogCommandService } from './catalogCommandService.js';
import { createCatalogIdempotencyRepository } from './catalogIdempotencyRepository.js';
import { createCatalogSlugHistoryRepository } from './catalogSlugHistoryRepository.js';
import { createCatalogVersionCommitService } from './catalogVersionCommitService.js';
import { createCatalogWriteService } from './catalogWriteService.js';

const timestamp = '2026-07-31T00:00:00.000Z';
const baseProduct = {
  id: 'product-base',
  name: 'Base Product',
  slug: 'base-product',
  operation: 'new_subscription',
  coverageType: 'country',
  coverageIds: ['vn'],
  image: '/images/base.png',
  featured: false,
  status: 'draft',
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const productRequest = (catalogVersionId, changes = {}) => ({
  idempotencyKey: 'create-product-key',
  catalogVersionId,
  product: {
    id: 'product-new',
    name: 'Sản phẩm mới',
    slug: 'san-pham-moi',
    operation: 'new_subscription',
    coverageType: 'country',
    coverageIds: ['jp'],
    image: '/images/japan.png',
    description: '<p onclick="bad()">An toàn<script>bad()</script></p>',
    featured: false,
    ...changes,
  },
});

const manualVariantRequest = (catalogVersionId, changes = {}) => ({
  idempotencyKey: 'create-variant-key',
  catalogVersionId,
  variant: {
    id: 'variant-new',
    sku: 'NEW-SKU-1',
    dataLimit: '10 GB',
    duration: '15 Ngày',
    price: 100000,
    compareAtPrice: 120000,
    currency: 'VND',
    medium: 'esim',
    supplier: 'hico',
    fulfillmentMethod: 'HICO_MANUAL_QR',
    requiresExistingSim: false,
    ...changes,
  },
});

const physicalVariantRequest = (catalogVersionId, changes = {}) => ({
  idempotencyKey: 'create-physical-key',
  catalogVersionId,
  variant: {
    id: 'variant-physical-new',
    sku: 'PHYSICAL-SKU-1',
    dataLimit: '5 GB',
    duration: '30 Ngày',
    price: 200000,
    currency: 'VND',
    medium: 'physical_sim',
    supplier: 'hico',
    fulfillmentMethod: 'HICO_PHYSICAL_STOCK',
    requiresExistingSim: false,
    ...changes,
  },
});

const physicalVariantUpdate = (catalogVersionId, variantVersion, changes = {}) => ({
  idempotencyKey: 'update-physical-key',
  catalogVersionId,
  version: variantVersion,
  changes,
});

const setup = async (t, {
  source = 'canonical',
  references = {
    productReferences: async () => [],
    variantReferences: async () => [],
  },
} = {}) => {
  const uploadsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'hico-write-service-'),
  );
  t.after(() => rm(uploadsDirectory, { recursive: true, force: true }));
  const env = { CATALOG_READ_SOURCE: source };
  const commitService = createCatalogVersionCommitService({
    uploadsDirectory,
    logger: { warn() {} },
  });
  await commitService.commit({
    versionId: 'catalog-base',
    parentVersionId: null,
    products: [baseProduct],
    variants: [],
    commandType: 'MIGRATE',
    commandId: 'migration',
    requestHash: 'migration',
    createdAt: timestamp,
  });
  const canonicalRepository = createCanonicalCatalogRepository({
    uploadsDirectory,
  });
  const auditRepository = createCatalogAuditRepository({
    recordsFile: path.join(uploadsDirectory, 'catalog_audit.json'),
  });
  const slugHistoryRepository = createCatalogSlugHistoryRepository({
    recordsFile: path.join(uploadsDirectory, 'catalog_slug_history.json'),
  });
  const idempotencyRepository = createCatalogIdempotencyRepository({
    recordsFile: path.join(uploadsDirectory, 'catalog_idempotency.json'),
    now: () => new Date('2026-07-31T00:00:00.000Z'),
  });
  let versionSequence = 0;
  let idSequence = 0;
  let timeSequence = 0;
  const makeService = (overrides = {}) => createCatalogWriteService({
    env,
    uploadsDirectory,
    canonicalRepository,
    providerRepository: { listOffers: async () => [] },
    commandService: createCatalogCommandService({
      env,
      idempotencyRepository,
    }),
    commitService,
    auditRepository,
    slugHistoryRepository,
    referenceService: references,
    now: () => new Date(Date.parse(timestamp) + (++timeSequence * 1000)),
    idFactory: (prefix) => `${prefix}-${++idSequence}`,
    versionIdFactory: () => `catalog-write-${++versionSequence}`,
    ...overrides,
  });
  return {
    env,
    makeService,
    service: makeService(),
    canonicalRepository,
    commitService,
    auditRepository,
    slugHistoryRepository,
  };
};

const currentId = async (fixture) => (
  (await fixture.canonicalRepository.readCurrentManifest()).versionId
);

test('create product is draft-first, sanitized and idempotent across restart', async (t) => {
  const fixture = await setup(t);
  const request = productRequest(await currentId(fixture));
  const created = await fixture.service.createProduct(request);
  assert.equal(created.status, 201);
  assert.equal(created.body.product.status, 'draft');
  assert.equal(created.body.product.version, 1);
  assert.equal(created.body.product.description, '<p>An toàn</p>');

  const replay = await fixture.makeService().createProduct(request);
  assert.equal(replay.replayed, true);
  assert.equal(replay.body.catalogVersionId, created.body.catalogVersionId);
  assert.equal((await fixture.commitService.listVersions()).length, 2);

  await assert.rejects(
    fixture.service.createProduct({
      ...request,
      product: { ...request.product, name: 'Payload khác' },
    }),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT',
  );
});

test('product uniqueness, update concurrency and slug history are enforced', async (t) => {
  const fixture = await setup(t);
  const created = await fixture.service.createProduct(
    productRequest(await currentId(fixture)),
  );
  await assert.rejects(
    fixture.service.createProduct({
      ...productRequest(created.body.catalogVersionId, {
        id: 'product-new',
        slug: 'duplicate-id-slug',
      }),
      idempotencyKey: 'duplicate-product-id',
    }),
    (error) => error.code === 'PRODUCT_ID_CONFLICT',
  );
  const updated = await fixture.service.updateProduct('product-new', {
    idempotencyKey: 'update-name',
    catalogVersionId: created.body.catalogVersionId,
    version: 1,
    changes: { name: 'Tên đã cập nhật' },
  });
  assert.equal(updated.body.product.slug, 'san-pham-moi');
  assert.equal(updated.body.product.version, 2);
  const updateAudit = await fixture.auditRepository.list({
    entityType: 'product',
    entityId: 'product-new',
  });
  assert.deepEqual(
    updateAudit.items.find((item) => item.action === 'UPDATE_PRODUCT')
      .changedFields,
    ['name'],
  );

  await assert.rejects(
    fixture.service.updateProduct('product-new', {
      idempotencyKey: 'stale-version',
      catalogVersionId: updated.body.catalogVersionId,
      version: 1,
      changes: { name: 'Stale' },
    }),
    (error) => error.code === 'ENTITY_VERSION_CONFLICT',
  );

  const slugUpdated = await fixture.service.updateProduct('product-new', {
    idempotencyKey: 'update-slug',
    catalogVersionId: updated.body.catalogVersionId,
    version: 2,
    changes: { slug: 'slug-moi' },
  });
  assert.equal(slugUpdated.body.product.slug, 'slug-moi');
  assert.deepEqual(
    (await fixture.slugHistoryRepository.list('product-new'))
      .map(({ oldSlug, newSlug }) => ({ oldSlug, newSlug })),
    [{ oldSlug: 'san-pham-moi', newSlug: 'slug-moi' }],
  );

  await assert.rejects(
    fixture.service.createProduct({
      ...productRequest(
        slugUpdated.body.catalogVersionId,
        { id: 'other-id', slug: 'slug-moi' },
      ),
      idempotencyKey: 'duplicate-slug',
    }),
    (error) => error.code === 'SLUG_CONFLICT',
  );
});

test('archive succeeds with references and hard delete requires unreferenced draft', async (t) => {
  const fixture = await setup(t, {
    references: {
      productReferences: async (product) => (
        product.id === 'product-base'
          ? [{ source: 'orders', count: 1 }]
          : []
      ),
      variantReferences: async () => [],
    },
  });
  const archived = await fixture.service.setProductArchived(
    'product-base',
    {
      idempotencyKey: 'archive-base',
      catalogVersionId: await currentId(fixture),
      version: 1,
    },
    true,
  );
  assert.equal(archived.body.product.status, 'archived');

  await assert.rejects(
    fixture.service.deleteProduct('product-base', {
      idempotencyKey: 'delete-referenced',
      catalogVersionId: archived.body.catalogVersionId,
      version: 2,
    }),
    (error) => error.code === 'REFERENCE_CONFLICT',
  );

  const created = await fixture.service.createProduct({
    ...productRequest(archived.body.catalogVersionId, {
      id: 'delete-me',
      slug: 'delete-me',
    }),
    idempotencyKey: 'create-delete-me',
  });
  const deleted = await fixture.service.deleteProduct('delete-me', {
    idempotencyKey: 'delete-me',
    catalogVersionId: created.body.catalogVersionId,
    version: 1,
  });
  assert.equal(deleted.body.deleted, true);
});

test('variant is inactive-first and enforces SKU/version/archive/delete rules', async (t) => {
  const fixture = await setup(t);
  const created = await fixture.service.createVariant(
    'product-base',
    manualVariantRequest(await currentId(fixture)),
  );
  assert.equal(created.body.variant.active, false);
  assert.equal(created.body.variant.version, 1);

  await assert.rejects(
    fixture.service.createVariant('product-base', {
      ...manualVariantRequest(created.body.catalogVersionId, {
        id: 'variant-new',
        sku: 'UNIQUE-FOR-DUPLICATE-ID',
      }),
      idempotencyKey: 'duplicate-variant-id',
    }),
    (error) => error.code === 'VARIANT_ID_CONFLICT',
  );

  await assert.rejects(
    fixture.service.createVariant('product-base', {
      ...manualVariantRequest(created.body.catalogVersionId, {
        id: 'variant-duplicate',
      }),
      idempotencyKey: 'duplicate-sku',
    }),
    (error) => error.code === 'SKU_CONFLICT',
  );

  const archived = await fixture.service.setVariantArchived(
    'product-base',
    'variant-new',
    {
      idempotencyKey: 'archive-variant',
      catalogVersionId: created.body.catalogVersionId,
      version: 1,
    },
    true,
  );
  assert.equal(archived.body.variant.archived, true);

  const restored = await fixture.service.setVariantArchived(
    'product-base',
    'variant-new',
    {
      idempotencyKey: 'restore-variant',
      catalogVersionId: archived.body.catalogVersionId,
      version: 2,
    },
    false,
  );
  assert.equal(restored.body.variant.active, false);

  await assert.rejects(
    fixture.service.updateVariant('product-base', 'variant-new', {
      idempotencyKey: 'variant-stale',
      catalogVersionId: restored.body.catalogVersionId,
      version: 1,
      changes: { price: 90000 },
    }),
    (error) => error.code === 'ENTITY_VERSION_CONFLICT',
  );

  const deleted = await fixture.service.deleteVariant(
    'product-base',
    'variant-new',
    {
      idempotencyKey: 'delete-variant',
      catalogVersionId: restored.body.catalogVersionId,
      version: 3,
    },
  );
  assert.equal(deleted.body.deleted, true);
});

test('rollback creates a new version with audit and correct parent', async (t) => {
  const fixture = await setup(t);
  const created = await fixture.service.createProduct(
    productRequest(await currentId(fixture)),
    { id: 'admin-1', role: 'catalog_admin' },
  );
  const rollback = await fixture.service.rollback('catalog-base', {
    idempotencyKey: 'rollback-key',
    catalogVersionId: created.body.catalogVersionId,
  }, { id: 'admin-1', role: 'catalog_admin' });
  assert.equal(rollback.body.rolledBackTo, 'catalog-base');
  assert.notEqual(rollback.body.catalogVersionId, 'catalog-base');

  const current = await fixture.canonicalRepository.readCatalog({
    required: true,
  });
  assert.deepEqual(current.products.map((item) => item.id), ['product-base']);
  assert.equal(
    current.manifest.parentVersionId,
    created.body.catalogVersionId,
  );
  const audit = await fixture.auditRepository.list();
  assert.ok(audit.items.some((item) => item.action === 'ROLLBACK_CATALOG'));
  assert.equal(JSON.stringify(audit).includes('onclick'), false);
});

test('canonical writes are locked while legacy source is active', async (t) => {
  const fixture = await setup(t, { source: 'legacy' });
  await assert.rejects(
    fixture.service.createProduct(productRequest('catalog-base')),
    (error) => error.code === 'CANONICAL_WRITE_DISABLED',
  );
  assert.equal((await fixture.commitService.listVersions()).length, 1);
});

test('concurrent commands serialize and reject a stale catalog base', async (t) => {
  const fixture = await setup(t);
  const baseVersion = await currentId(fixture);
  const requests = [
    {
      ...productRequest(baseVersion, {
        id: 'concurrent-a',
        slug: 'concurrent-a',
      }),
      idempotencyKey: 'concurrent-a',
    },
    {
      ...productRequest(baseVersion, {
        id: 'concurrent-b',
        slug: 'concurrent-b',
      }),
      idempotencyKey: 'concurrent-b',
    },
  ];
  const results = await Promise.allSettled(
    requests.map((request) => fixture.service.createProduct(request)),
  );
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'CATALOG_VERSION_CONFLICT');
  assert.equal((await fixture.commitService.listVersions()).length, 2);
});

test('audit persistence failure leaves pointer and version list unchanged', async (t) => {
  const fixture = await setup(t);
  const service = fixture.makeService({
    auditRepository: {
      append: async () => {
        throw new Error('audit storage failed');
      },
      remove: async () => undefined,
    },
  });
  await assert.rejects(
    service.createProduct(productRequest(await currentId(fixture))),
    /audit storage failed/,
  );
  assert.equal(await currentId(fixture), 'catalog-base');
  assert.equal((await fixture.commitService.listVersions()).length, 1);
});

// ─── Legacy unknown physical stock tests ────────────────────────────────────────
// These tests verify that existing variants with stock=null (legacy unknown stock)
// can be updated without the stock being changed, while new variants still require
// an integer stock value.

const withLegacyNullStockVariant = async (t, testFn) => {
  // Build a base catalog with a pre-existing variant that has stock=null
  const uploadsDirectory = await mkdtemp(path.join(os.tmpdir(), 'hico-legacy-stock-'));
  t.after(() => rm(uploadsDirectory, { recursive: true, force: true }));

  const commitService = createCatalogVersionCommitService({
    uploadsDirectory,
    logger: { warn() {} },
  });
  // Pre-seed a product and a physical variant with stock=null (simulates legacy data)
  await commitService.commit({
    versionId: 'catalog-legacy',
    parentVersionId: null,
    products: [{
      id: 'product-legacy-stock',
      name: 'Legacy Stock Product',
      slug: 'legacy-stock',
      operation: 'new_subscription',
      coverageType: 'country',
      coverageIds: ['vn'],
      image: '/images/legacy.png',
      featured: false,
      status: 'active',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    variants: [{
      id: 'variant-legacy-null',
      productId: 'product-legacy-stock',
      sku: 'LEGACY-NULL-STOCK',
      dataLimit: '3 GB',
      duration: '7 Ngày',
      price: 150000,
      currency: 'VND',
      medium: 'physical_sim',
      supplier: 'hico',
      fulfillmentMethod: 'HICO_PHYSICAL_STOCK',
      requiresExistingSim: false,
      stock: null, // legacy unknown stock
      active: true,
      needsReview: false,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    commandType: 'MIGRATE',
    commandId: 'legacy-migration',
    requestHash: 'legacy',
    createdAt: timestamp,
  });

  const canonicalRepository = createCanonicalCatalogRepository({ uploadsDirectory });
  const auditRepository = createCatalogAuditRepository({
    recordsFile: path.join(uploadsDirectory, 'catalog_audit.json'),
  });
  const slugHistoryRepository = createCatalogSlugHistoryRepository({
    recordsFile: path.join(uploadsDirectory, 'catalog_slug_history.json'),
  });
  const idempotencyRepository = createCatalogIdempotencyRepository({
    recordsFile: path.join(uploadsDirectory, 'catalog_idempotency.json'),
    now: () => new Date(timestamp),
  });
  let versionSequence = 0;
  const makeService = (overrides = {}) => createCatalogWriteService({
    env: {},
    uploadsDirectory,
    canonicalRepository,
    providerRepository: { listOffers: async () => [] },
    commandService: createCatalogCommandService({
      env: {},
      idempotencyRepository,
    }),
    commitService,
    auditRepository,
    slugHistoryRepository,
    referenceService: {
      productReferences: async () => [],
      variantReferences: async () => [],
    },
    now: () => new Date(timestamp),
    idFactory: (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}`,
    versionIdFactory: () => `catalog-legacy-write-${++versionSequence}`,
    ...overrides,
  });

  await testFn({
    service: makeService(),
    canonicalRepository,
    commitService,
  });
};

test('update existing physical variant with stock=null preserves null on metadata-only update', async (t) => {
  await withLegacyNullStockVariant(t, async (fixture) => {
    // Read current manifest to get the version ID
    const manifest = await fixture.canonicalRepository.readCurrentManifest();
    assert.equal(manifest.versionId, 'catalog-legacy');

    // Metadata-only update: do NOT send stock in the changes
    const result = await fixture.service.updateVariant(
      'product-legacy-stock',
      'variant-legacy-null',
      {
        idempotencyKey: 'legacy-metadata-update',
        catalogVersionId: manifest.versionId,
        version: 1,
        changes: {
          networkLabel: 'ETL 4G/LTE',
          activationPolicy: 'Tự động',
          hotspotSupport: 'true',
          // stock is intentionally omitted — this is the key scenario
        },
      },
      { id: 'admin-1', role: 'catalog_admin' },
    );
    assert.equal(result.body.variant.stock, null, 'stock must remain null');
    assert.equal(result.body.variant.networkLabel, 'ETL 4G/LTE');
    assert.equal(result.body.variant.activationPolicy, 'Tự động');
    assert.equal(result.body.variant.hotspotSupport, 'true');
    assert.equal(result.body.variant.version, 2);
    // UNKNOWN_PHYSICAL_STOCK warning expected when stock=null is preserved
    const warnings = result.body.warnings ?? [];
    assert.ok(
      warnings.some((w) => w.code === 'UNKNOWN_PHYSICAL_STOCK'),
      'Expected UNKNOWN_PHYSICAL_STOCK warning',
    );
  });
});

test('create new physical variant with stock=null fails validation', async (t) => {
  const fixture = await setup(t);
  const productResult = await fixture.service.createProduct(
    productRequest(await currentId(fixture), {
      id: 'product-new-physical',
      slug: 'product-new-physical',
    }),
    { id: 'admin-1', role: 'catalog_admin' },
  );

  await assert.rejects(
    fixture.service.createVariant(
      'product-new-physical',
      physicalVariantRequest(productResult.body.catalogVersionId, {
        id: 'variant-new-physical-null',
        sku: 'NEW-PHYSICAL-NULL',
        stock: null, // new variant must have integer stock
      }),
      { id: 'admin-1', role: 'catalog_admin' },
    ),
    (error) => error.code === 'INVALID_HICO_PHYSICAL_STOCK',
  );
});

test('update existing physical variant with stock=12 preserves stock on metadata-only update', async (t) => {
  const fixture = await setup(t);
  const productResult = await fixture.service.createProduct(
    productRequest(await currentId(fixture), {
      id: 'product-known-stock',
      slug: 'product-known-stock',
    }),
    { id: 'admin-1', role: 'catalog_admin' },
  );

  const createResult = await fixture.service.createVariant(
    'product-known-stock',
    physicalVariantRequest(productResult.body.catalogVersionId, {
      id: 'variant-known-stock',
      sku: 'KNOWN-STOCK',
      stock: 12,
    }),
    { id: 'admin-1', role: 'catalog_admin' },
  );
  assert.equal(createResult.body.variant.stock, 12);

  const updateResult = await fixture.service.updateVariant(
    'product-known-stock',
    'variant-known-stock',
    {
      idempotencyKey: 'metadata-known-stock-key',
      catalogVersionId: createResult.body.catalogVersionId,
      version: 1,
      changes: {
        networkLabel: 'Viettel 4G',
      },
    },
    { id: 'admin-1', role: 'catalog_admin' },
  );
  assert.equal(updateResult.body.variant.stock, 12, 'stock must be preserved');
  assert.equal(updateResult.body.variant.networkLabel, 'Viettel 4G');
});

test('update existing physical variant with stock=null can set stock to a value', async (t) => {
  await withLegacyNullStockVariant(t, async (fixture) => {
    const manifest = await fixture.canonicalRepository.readCurrentManifest();

    // Update: explicitly set stock to a value while also updating metadata
    const result = await fixture.service.updateVariant(
      'product-legacy-stock',
      'variant-legacy-null',
      {
        idempotencyKey: 'legacy-set-stock',
        catalogVersionId: manifest.versionId,
        version: 1,
        changes: {
          stock: 5,
          networkLabel: 'Mobifone 3G',
        },
      },
      { id: 'admin-1', role: 'catalog_admin' },
    );
    assert.equal(result.body.variant.stock, 5, 'stock must be set to 5');
    assert.equal(result.body.variant.networkLabel, 'Mobifone 3G');
    assert.equal(result.body.variant.version, 2);

    // No UNKNOWN_PHYSICAL_STOCK warning since stock is now known
    const warnings = result.body.warnings ?? [];
    assert.ok(
      !warnings.some((w) => w.code === 'UNKNOWN_PHYSICAL_STOCK'),
      'No UNKNOWN_PHYSICAL_STOCK warning when stock is set',
    );
  });
});
