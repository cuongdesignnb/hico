import assert from 'node:assert/strict';
import test from 'node:test';
import { parseA1Range, sampleA1Range, splitA1RangeIntoBatches } from './googleSheetRangeBatches.js';

const rowsFor = (batches) => batches.reduce((total, batch) => total + batch.rowCount, 0);

test('parseA1Range accepts logical ranges beyond one batch', () => {
  assert.deepEqual(parseA1Range('A1:Y17666'), { startColumn: 1, endColumn: 25, startRow: 1, endRow: 17666 });
});

test('splitA1RangeIntoBatches preserves every row without overlap', () => {
  const batches = splitA1RangeIntoBatches({ range: 'A1:Y17666', maxRowsPerBatch: 5000, headerRow: 1 });
  assert.deepEqual(batches.map((batch) => batch.range), ['A1:Y5000', 'A5001:Y10000', 'A10001:Y15000', 'A15001:Y17666']);
  assert.equal(rowsFor(batches), 17666);
  assert.equal(batches.every((batch, index) => batch.rowCount <= 5000 && (index === 0 || batch.startRow === batches[index - 1].endRow + 1)), true);
  assert.equal(batches.filter((batch) => batch.includesHeader).length, 1);
});

test('batch boundaries include exact one-batch and header-offset cases', () => {
  assert.equal(splitA1RangeIntoBatches({ range: 'A1:Y5000', headerRow: 1 }).length, 1);
  assert.equal(splitA1RangeIntoBatches({ range: 'A1:Y5001', headerRow: 1 }).length, 2);
  assert.equal(splitA1RangeIntoBatches({ range: 'A1:Y10000', headerRow: 1 }).length, 2);
  assert.equal(splitA1RangeIntoBatches({ range: 'A1:Y10001', headerRow: 1 }).length, 3);
  assert.equal(splitA1RangeIntoBatches({ range: 'A2:Y5001', headerRow: 2 }).length, 1);
});

test('sample range starts at the real header row and remains bounded', () => {
  assert.equal(sampleA1Range({ range: 'A1:Y17666', headerRow: 3, maxRows: 20 }), 'A3:Y22');
});
