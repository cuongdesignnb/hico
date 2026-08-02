import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalogReader } from './canonicalCatalogReader.js';

const legacy = {
  destinations: [{
    id: 'legacy',
    name: 'Legacy',
    variants: [{ id: 'lv1', sku: 'LSKU', price: 1 }],
  }],
  packages: [],
};
const canonical = {
  products: [{ id: 'canonical', status: 'active' }],
  variants: [{ id: 'cv1', productId: 'canonical' }],
};

const createReader = (env, canonicalRepository, logger = { warn() {} }) => (
  createCanonicalCatalogReader({
    env,
    logger,
    legacyRepository: { readLegacyCatalog: async () => legacy },
    canonicalRepository,
  })
);

test('reads legacy when explicitly selected and supports canonical rollback', async () => {
  const env = { CATALOG_READ_SOURCE: 'legacy' };
  const reader = createReader(env, {
    readCatalog: async () => canonical,
  });
  assert.equal((await reader.readCatalog()).products[0].id, 'legacy');
  env.CATALOG_READ_SOURCE = 'canonical';
  assert.equal((await reader.readCatalog()).products[0].id, 'canonical');
  env.CATALOG_READ_SOURCE = 'legacy';
  assert.equal((await reader.readCatalog()).products[0].id, 'legacy');
});

test('canonical is the default source when no source is provided', async () => {
  const reader = createReader({}, { readCatalog: async () => canonical });
  assert.equal((await reader.readCatalog()).products[0].id, 'canonical');
});

test('canonical missing or parse failures are explicit by default', async () => {
  const reader = createReader(
    { CATALOG_READ_SOURCE: 'canonical' },
    { readCatalog: async () => { throw new SyntaxError('bad canonical'); } },
  );
  await assert.rejects(reader.readCatalog(), /bad canonical/);
});

test('explicit canonical fallback logs and reads legacy', async () => {
  const warnings = [];
  const reader = createReader(
    {
      CATALOG_READ_SOURCE: 'canonical',
      CATALOG_CANONICAL_FALLBACK: 'true',
    },
    { readCatalog: async () => { throw new Error('missing'); } },
    { warn: (message) => warnings.push(message) },
  );
  assert.equal((await reader.readCatalog()).products[0].id, 'legacy');
  assert.equal(warnings.length, 1);
});

test('rejects unsupported read source', async () => {
  const reader = createReader(
    { CATALOG_READ_SOURCE: 'unknown' },
    { readCatalog: async () => canonical },
  );
  await assert.rejects(reader.readCatalog(), /Unsupported/);
});
