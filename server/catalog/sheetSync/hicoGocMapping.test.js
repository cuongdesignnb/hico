import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_HICO_GOC_FIELD_MAPPING, hicoGocColumnName, parseHicoGocRange, validateHicoGocRange } from './hicoGocMapping.js';

const headers = Array.from({ length: 25 }, (_, index) => `Header ${index + 1}`);

test('HICO GỐC mapping identifies the required last column without hard-coding a range', () => {
  const result = validateHicoGocRange({ sheetRange: 'A1:Y5000', headers, fieldMapping: DEFAULT_HICO_GOC_FIELD_MAPPING });
  assert.equal(result.requiredLastColumn, 'Y');
  assert.equal(result.configuredLastColumn, 'Y');
  assert.equal(hicoGocColumnName(24), 'Y');
});

test('HICO GỐC rejects a configured range that stops before identity columns', () => {
  assert.throws(
    () => validateHicoGocRange({ sheetRange: 'A1:K17666', headers: headers.slice(0, 11), fieldMapping: DEFAULT_HICO_GOC_FIELD_MAPPING }),
    (error) => error.code === 'SHEET_RANGE_INCOMPLETE' && error.details.requiredLastColumn === 'Y',
  );
});

test('HICO GỐC rejects mapping columns that are not present in the header', () => {
  assert.throws(
    () => validateHicoGocRange({ sheetRange: 'A1:Y5000', headers: headers.slice(0, 20), fieldMapping: DEFAULT_HICO_GOC_FIELD_MAPPING }),
    (error) => error.code === 'MAPPING_COLUMN_OUT_OF_RANGE' && error.details.field === 'wmproductIdPhysical',
  );
});

test('HICO GỐC range parser reports malformed ranges without contacting the Sheet', () => {
  assert.deepEqual(parseHicoGocRange('A1:AT17666'), { startColumn: 0, endColumn: 45 });
  assert.throws(() => parseHicoGocRange('A1:K'), (error) => error.code === 'GOOGLE_SHEET_RANGE_INVALID');
});
