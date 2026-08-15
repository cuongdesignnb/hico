import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checksumCatalog } from './canonicalCatalogChecksum.js';
import { createCanonicalCatalogRepository } from './canonicalCatalogRepository.js';
import { cloneSeedCategories } from '../categories/catalogCategories.js';

const timestamp = '2026-07-30T00:00:00.000Z';
const categories = cloneSeedCategories();
const products = [{
  id: 'p1',
  slug: 'san-pham',
  name: 'Sản phẩm',
  operation: 'new_subscription',
  coverageType: 'country',
  coverageIds: ['p1'],
  featured: false,
  status: 'active',
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
}];
const variants = [{
  id: 'v1',
  productId: 'p1',
  sku: 'SKU-1',
  price: 1000,
  compareAtPrice: null,
  currency: 'VND',
  medium: 'esim',
  supplier: 'other',
  fulfillmentMethod: 'MANUAL_PROCESSING',
  requiresExistingSim: false,
  active: true,
  needsReview: true,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
}];

test('atomically writes a version, pointer and compatibility mirrors', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-canonical-'));
  try {
    const repository = createCanonicalCatalogRepository({
      uploadsDirectory: directory,
    });
    const checksums = checksumCatalog({ products, variants, categories });
    await repository.writeVersion({
      migrationId: 'catalog-test',
      products,
      variants,
      categories,
      checksums,
      createdAt: timestamp,
    });
    const current = await repository.readCatalog({ required: true });
    assert.deepEqual(current.products, products);
    assert.deepEqual(current.variants, variants);
    assert.deepEqual(current.categories, categories);
    assert.equal(current.manifest.businessChecksum, checksums.businessChecksum);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(directory, 'catalog_products.json'))),
      products,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('validation failure does not replace an existing pointer', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-canonical-'));
  try {
    const repository = createCanonicalCatalogRepository({
      uploadsDirectory: directory,
    });
    const checksums = checksumCatalog({ products, variants, categories });
    await repository.writeVersion({
      migrationId: 'catalog-good',
      products,
      variants,
      categories,
      checksums,
      createdAt: timestamp,
    });
    const before = await repository.readCurrentManifest();
    await assert.rejects(
      repository.writeVersion({
        migrationId: 'catalog-bad',
        products,
        variants: [{ ...variants[0], price: -1 }],
        categories,
        checksums,
        createdAt: timestamp,
      }),
      /validation failed/,
    );
    assert.deepEqual(await repository.readCurrentManifest(), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing canonical is controlled and malformed pointer is rejected', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-canonical-'));
  try {
    const repository = createCanonicalCatalogRepository({
      uploadsDirectory: directory,
    });
    assert.deepEqual(await repository.readCatalog(), {
      products: [],
      variants: [],
      categories,
      manifest: null,
    });
    await assert.rejects(
      repository.readCatalog({ required: true }),
      /has not been migrated/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reads a schema v1 manifest with seeded categories for compatibility', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-canonical-v1-'));
  try {
    const versionDirectory = path.join(directory, 'catalog_versions', 'catalog-v1');
    await mkdir(versionDirectory, { recursive: true });
    const checksums = checksumCatalog({ products, variants });
    const manifest = {
      schemaVersion: 1,
      migrationId: 'catalog-v1',
      productsFile: 'catalog_versions/catalog-v1/catalog_products.json',
      variantsFile: 'catalog_versions/catalog-v1/catalog_variants.json',
      productsChecksum: checksums.productsChecksum,
      variantsChecksum: checksums.variantsChecksum,
      businessChecksum: checksums.businessChecksum,
      createdAt: timestamp,
    };
    await Promise.all([
      writeFile(path.join(versionDirectory, 'catalog_products.json'), JSON.stringify(products), 'utf8'),
      writeFile(path.join(versionDirectory, 'catalog_variants.json'), JSON.stringify(variants), 'utf8'),
      writeFile(path.join(directory, 'catalog_current.json'), JSON.stringify(manifest), 'utf8'),
    ]);
    const repository = createCanonicalCatalogRepository({ uploadsDirectory: directory });
    const current = await repository.readCatalog({ required: true });
    assert.deepEqual(current.products, products);
    assert.deepEqual(current.variants, variants);
    assert.deepEqual(current.categories, categories);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects canonical content that does not match the manifest checksum', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-canonical-'));
  try {
    const repository = createCanonicalCatalogRepository({
      uploadsDirectory: directory,
    });
    const checksums = checksumCatalog({ products, variants, categories });
    await repository.writeVersion({
      migrationId: 'catalog-checksum',
      products,
      variants,
      categories,
      checksums,
      createdAt: timestamp,
    });
    await writeFile(
      path.join(
        directory,
        'catalog_versions',
        'catalog-checksum',
        'catalog_products.json',
      ),
      JSON.stringify([{ ...products[0], name: 'Changed' }]),
      'utf8',
    );
    await assert.rejects(
      repository.readCatalog({ required: true }),
      /checksum does not match/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
