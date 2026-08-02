import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCatalogVersionCommitService } from './catalogVersionCommitService.js';

const timestamp = '2026-07-31T00:00:00.000Z';
const products = [{
  id: 'product-1',
  name: 'Product 1',
  slug: 'product-1',
  operation: 'new_subscription',
  coverageType: 'country',
  coverageIds: ['vn'],
  featured: false,
  status: 'draft',
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
}];
const variants = [{
  id: 'variant-1',
  productId: 'product-1',
  sku: 'SKU-1',
  price: 100,
  compareAtPrice: null,
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
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
}];

const commitInput = (versionId, parentVersionId = null) => ({
  versionId,
  parentVersionId,
  products,
  variants,
  commandType: 'CREATE_PRODUCT',
  commandId: `command-${versionId}`,
  requestHash: `hash-${versionId}`,
  createdAt: timestamp,
});

const setup = async (t) => {
  const uploadsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'hico-write-commit-'),
  );
  t.after(() => rm(uploadsDirectory, { recursive: true, force: true }));
  const service = createCatalogVersionCommitService({
    uploadsDirectory,
    logger: { warn() {} },
  });
  await service.commit(commitInput('catalog-base'));
  return { uploadsDirectory, service };
};

test('atomic commit writes checksums, parent version and readable manifest', async (t) => {
  const { service } = await setup(t);
  const result = await service.commit(commitInput('catalog-next', 'catalog-base'));
  assert.equal(result.manifest.parentVersionId, 'catalog-base');
  assert.equal(result.manifest.versionId, 'catalog-next');
  const read = await service.readVersion('catalog-next');
  assert.deepEqual(read.products, products);
  assert.deepEqual(read.variants, variants);
  assert.equal((await service.listVersions()).length, 2);
});

for (const phase of ['products', 'variants', 'manifest', 'pointer']) {
  test(`${phase} failure leaves the previous pointer active`, async (t) => {
    const { uploadsDirectory } = await setup(t);
    const failing = createCatalogVersionCommitService({
      uploadsDirectory,
      failureInjector: async (currentPhase) => {
        if (currentPhase === phase) throw new Error(`fail:${phase}`);
      },
      logger: { warn() {} },
    });
    await assert.rejects(
      failing.commit(commitInput(`catalog-fail-${phase}`, 'catalog-base')),
      new RegExp(`fail:${phase}`),
    );
    const pointer = JSON.parse(await readFile(
      path.join(uploadsDirectory, 'catalog_current.json'),
      'utf8',
    ));
    assert.equal(pointer.versionId, 'catalog-base');
    assert.equal(
      (await failing.listVersions()).some(
        (manifest) => manifest.versionId === `catalog-fail-${phase}`,
      ),
      false,
    );
  });
}

test('mirror failure keeps canonical commit valid and returns a warning', async (t) => {
  const { uploadsDirectory } = await setup(t);
  const service = createCatalogVersionCommitService({
    uploadsDirectory,
    failureInjector: async (phase) => {
      if (phase === 'mirrors') throw new Error('mirror failed');
    },
    logger: { warn() {} },
  });
  const result = await service.commit(
    commitInput('catalog-mirror-warning', 'catalog-base'),
  );
  assert.equal(result.warnings[0].code, 'MIRROR_UPDATE_FAILED');
  const pointer = JSON.parse(await readFile(
    path.join(uploadsDirectory, 'catalog_current.json'),
    'utf8',
  ));
  assert.equal(pointer.versionId, 'catalog-mirror-warning');
  assert.equal(
    (await service.readVersion('catalog-mirror-warning')).manifest.versionId,
    'catalog-mirror-warning',
  );
});

test('pointer failure rolls back pre-pointer audit/history effects', async (t) => {
  const { uploadsDirectory } = await setup(t);
  const effects = [];
  const service = createCatalogVersionCommitService({
    uploadsDirectory,
    failureInjector: async (phase) => {
      if (phase === 'pointer') throw new Error('pointer failed');
    },
    logger: { warn() {} },
  });
  await assert.rejects(
    service.commit({
      ...commitInput('catalog-pointer-effects', 'catalog-base'),
      beforePointer: async () => {
        effects.push('audit');
      },
      rollbackBeforePointer: async () => {
        effects.pop();
      },
    }),
    /pointer failed/,
  );
  assert.deepEqual(effects, []);
});

test('rollback target with invalid checksum is blocked', async (t) => {
  const { uploadsDirectory, service } = await setup(t);
  const productsFile = path.join(
    uploadsDirectory,
    'catalog_versions',
    'catalog-base',
    'catalog_products.json',
  );
  await import('node:fs/promises').then(({ writeFile }) => (
    writeFile(productsFile, '[]\n', 'utf8')
  ));
  await assert.rejects(
    service.readVersion('catalog-base'),
    (error) => error.code === 'VERSION_CHECKSUM_INVALID',
  );
});
