import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogReadCache } from './read/catalogReadCache.js';

test('catalog cache reads one immutable version once and reloads after pointer change', async () => {
  let version = 'catalog-1';
  let manifestReads = 0;
  let catalogReads = 0;
  const cache = createCatalogReadCache({
    key: 'catalog-cache-test',
    readManifest: async () => { manifestReads += 1; return { versionId: version }; },
    loadCatalog: async ({ manifest }) => { catalogReads += 1; return { manifest, products: [], variants: [] }; },
  });
  await Promise.all([cache.read(), cache.read(), cache.read()]);
  await cache.read();
  assert.equal(catalogReads, 1);
  assert.equal(manifestReads, 4);
  version = 'catalog-2';
  const next = await cache.read();
  assert.equal(next.manifest.versionId, 'catalog-2');
  assert.equal(catalogReads, 2);
});
