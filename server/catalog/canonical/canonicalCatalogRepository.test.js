import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checksumCatalog } from './canonicalCatalogChecksum.js';
import { createCanonicalCatalogRepository } from './canonicalCatalogRepository.js';

const timestamp = '2026-07-30T00:00:00.000Z';
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
    const checksums = checksumCatalog({ products, variants });
    await repository.writeVersion({
      migrationId: 'catalog-test',
      products,
      variants,
      checksums,
      createdAt: timestamp,
    });
    const current = await repository.readCatalog({ required: true });
    assert.deepEqual(current.products, products);
    assert.deepEqual(current.variants, variants);
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
    const checksums = checksumCatalog({ products, variants });
    await repository.writeVersion({
      migrationId: 'catalog-good',
      products,
      variants,
      checksums,
      createdAt: timestamp,
    });
    const before = await repository.readCurrentManifest();
    await assert.rejects(
      repository.writeVersion({
        migrationId: 'catalog-bad',
        products,
        variants: [{ ...variants[0], price: -1 }],
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

test('rejects canonical content that does not match the manifest checksum', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-canonical-'));
  try {
    const repository = createCanonicalCatalogRepository({
      uploadsDirectory: directory,
    });
    const checksums = checksumCatalog({ products, variants });
    await repository.writeVersion({
      migrationId: 'catalog-checksum',
      products,
      variants,
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
