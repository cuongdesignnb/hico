import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFullSyncCandidate, FULL_SYNC_GROUPING_FAILED } from './catalogResyncDiagnostics.js';

test('full sync reports grouping failure when parsed rows have no product groups', () => {
  assert.throws(
    () => assertFullSyncCandidate({
      source: { rowsRead: 1 },
      parser: { rowsParsed: 1, rowsRejected: 0, rejectionReasons: {} },
      candidate: { products: 0, variants: 0, validRows: 1, uniqueProductKeys: 0, topRejectionReasons: [] },
    }),
    (error) => error.code === FULL_SYNC_GROUPING_FAILED && error.details.rowsParsed === 1,
  );
});
