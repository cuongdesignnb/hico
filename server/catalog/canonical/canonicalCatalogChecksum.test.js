import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checksumCatalog,
  checksumRecords,
  stableSerialize,
} from './canonicalCatalogChecksum.js';

test('stable checksum ignores object key and record order', () => {
  const left = [{ id: 'b', name: 'B' }, { name: 'A', id: 'a' }];
  const right = [{ id: 'a', name: 'A' }, { name: 'B', id: 'b' }];
  assert.equal(checksumRecords(left), checksumRecords(right));
  assert.equal(
    stableSerialize({ b: 2, a: 1 }),
    stableSerialize({ a: 1, b: 2 }),
  );
});

test('business checksum ignores runtime timestamps', () => {
  const first = checksumCatalog({
    products: [{
      id: 'p1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    variants: [],
  });
  const second = checksumCatalog({
    products: [{
      id: 'p1',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    }],
    variants: [],
  });
  assert.notEqual(first.productsChecksum, second.productsChecksum);
  assert.equal(first.businessChecksum, second.businessChecksum);
});
