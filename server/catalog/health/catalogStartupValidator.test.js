import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checksumCatalog } from '../canonical/canonicalCatalogChecksum.js';
import { cloneSeedCategories } from '../categories/catalogCategories.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import {
  validateCanonicalCatalogStorage,
} from './catalogStartupValidator.js';

const timestamp = '2026-07-31T00:00:00.000Z';
const categories = cloneSeedCategories();
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

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));
const writeJson = (filePath, value) => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const setup = async (t) => {
  const uploadsDirectory = await mkdtemp(path.join(os.tmpdir(), 'hico-startup-validator-'));
  t.after(() => rm(uploadsDirectory, { recursive: true, force: true }));
  const commitService = createCatalogVersionCommitService({ uploadsDirectory, logger: { warn() {} } });
  await commitService.commit({
    versionId: 'catalog-base',
    parentVersionId: null,
    products,
    variants,
    categories,
    commandType: 'MIGRATE',
    commandId: 'migration',
    requestHash: 'migration',
    createdAt: timestamp,
  });
  return { uploadsDirectory, versionDirectory: path.join(uploadsDirectory, 'catalog_versions', 'catalog-base') };
};

const assertCode = async (uploadsDirectory, code) => {
  await assert.rejects(
    validateCanonicalCatalogStorage({ uploadsDirectory }),
    (error) => error.code === code,
  );
};

test('startup validator accepts a complete canonical pointer and ignores a mirror mismatch', async (t) => {
  const { uploadsDirectory } = await setup(t);
  const result = await validateCanonicalCatalogStorage({ uploadsDirectory });
  assert.deepEqual(
    { versionId: result.versionId, products: result.products, variants: result.variants, checksumValid: result.checksumValid },
    { versionId: 'catalog-base', products: 1, variants: 1, checksumValid: true },
  );
  await writeFile(path.join(uploadsDirectory, 'catalog_products.json'), '{"mirror":"stale"}\n', 'utf8');
  const afterMirrorMismatch = await validateCanonicalCatalogStorage({ uploadsDirectory });
  assert.equal(afterMirrorMismatch.healthy, true);
});

test('startup validator reports pointer, version, manifest and file failures', async (t) => {
  const cases = [
    ['pointer-missing', 'CATALOG_POINTER_MISSING', async ({ uploadsDirectory }) => unlink(path.join(uploadsDirectory, 'catalog_current.json'))],
    ['pointer-invalid', 'CATALOG_POINTER_INVALID', async ({ uploadsDirectory }) => writeFile(path.join(uploadsDirectory, 'catalog_current.json'), '{', 'utf8')],
    ['version-missing', 'CATALOG_VERSION_MISSING', async ({ uploadsDirectory }) => {
      const pointer = await readJson(path.join(uploadsDirectory, 'catalog_current.json'));
      pointer.versionId = '.catalog-stage.tmp';
      await writeJson(path.join(uploadsDirectory, 'catalog_current.json'), pointer);
    }],
    ['manifest-missing', 'CATALOG_MANIFEST_INVALID', async ({ versionDirectory }) => unlink(path.join(versionDirectory, 'manifest.json'))],
    ['products-missing', 'CATALOG_FILE_MISSING', async ({ versionDirectory }) => unlink(path.join(versionDirectory, 'catalog_products.json'))],
    ['variants-missing', 'CATALOG_FILE_MISSING', async ({ versionDirectory }) => unlink(path.join(versionDirectory, 'catalog_variants.json'))],
    ['products-corrupt', 'CATALOG_FILE_MISSING', async ({ versionDirectory }) => writeFile(path.join(versionDirectory, 'catalog_products.json'), '{', 'utf8')],
    ['schema-unsupported', 'CATALOG_SCHEMA_UNSUPPORTED', async ({ uploadsDirectory }) => {
      const pointer = await readJson(path.join(uploadsDirectory, 'catalog_current.json'));
      pointer.schemaVersion = 99;
      await writeJson(path.join(uploadsDirectory, 'catalog_current.json'), pointer);
    }],
    ['checksum-mismatch', 'CATALOG_CHECKSUM_MISMATCH', async ({ versionDirectory }) => writeFile(path.join(versionDirectory, 'catalog_products.json'), `${JSON.stringify([{ ...products[0], name: 'Changed' }])}\n`, 'utf8')],
  ];
  for (const [name, code, mutate] of cases) {
    await test(`failure injection: ${name}`, async (nested) => {
      const fixture = await setup(nested);
      await mutate(fixture);
      await assertCode(fixture.uploadsDirectory, code);
    });
  }
});

test('startup validator reports duplicate IDs and orphan variants after checksums are updated', async (t) => {
  const fixture = await setup(t);
  const productsFile = path.join(fixture.versionDirectory, 'catalog_products.json');
  const variantsFile = path.join(fixture.versionDirectory, 'catalog_variants.json');
  const currentFile = path.join(fixture.uploadsDirectory, 'catalog_current.json');
  const manifestFile = path.join(fixture.versionDirectory, 'manifest.json');
  const nextProducts = [...products, { ...products[0] }];
  const nextVariants = [{ ...variants[0], productId: 'missing-product' }];
  await writeJson(productsFile, nextProducts);
  await writeJson(variantsFile, nextVariants);
  const checksums = checksumCatalog({ products: nextProducts, variants: nextVariants, categories });
  const current = await readJson(currentFile);
  const manifest = await readJson(manifestFile);
  Object.assign(current, checksums);
  Object.assign(manifest, checksums);
  await writeJson(currentFile, current);
  await writeJson(manifestFile, manifest);
  await assertCode(fixture.uploadsDirectory, 'CATALOG_REFERENCE_INVALID');
});

test('business checksum mismatch is detected independently from record checksums', async (t) => {
  const fixture = await setup(t);
  const currentFile = path.join(fixture.uploadsDirectory, 'catalog_current.json');
  const manifestFile = path.join(fixture.versionDirectory, 'manifest.json');
  const current = await readJson(currentFile);
  const manifest = await readJson(manifestFile);
  current.businessChecksum = 'bad-business-checksum';
  manifest.businessChecksum = 'bad-business-checksum';
  await writeJson(currentFile, current);
  await writeJson(manifestFile, manifest);
  await assertCode(fixture.uploadsDirectory, 'CATALOG_CHECKSUM_MISMATCH');
});
