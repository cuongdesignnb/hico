import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFullSyncCandidate, catalogApplyReadiness, FULL_SYNC_GROUPING_FAILED } from './catalogResyncDiagnostics.js';

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

test('catalog apply remains ready while provider and operation diagnostics need review', () => {
  const readiness = catalogApplyReadiness({
    batch: {
      mode: 'full',
      status: 'READY_FOR_REVIEW',
      summary: {
        products: 3603,
        variants: 24235,
        provider: { resolved: 0, unresolved: 24235, ambiguous: 0, inactive: 0, needsReviewVariants: 24235 },
        operationUnresolved: 20175,
      },
    },
    rows: [{ status: 'VALID' }, { status: 'INVALID' }],
  });
  assert.equal(readiness.catalogApplyReady, true);
  assert.equal(readiness.validRows, 1);
  assert.equal(readiness.invalidRows, 1);
  assert.equal(readiness.providerWarning, true);
  assert.equal(readiness.operationWarning, true);
});
