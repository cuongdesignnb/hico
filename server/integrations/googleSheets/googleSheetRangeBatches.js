import { GoogleSheetSettingsError } from './googleSheetSecretCrypto.js';

export const MAX_SHEET_COLUMNS = 52;
export const DEFAULT_MAX_ROWS_PER_BATCH = 5000;

const invalidRange = (message = 'Google Sheet range is invalid.') => new GoogleSheetSettingsError(message, {
  code: 'GOOGLE_SHEET_RANGE_INVALID',
  status: 422,
});

export const columnName = (number) => {
  let result = '';
  for (let value = Number(number); value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
};
const columnNumber = (value) => String(value).toUpperCase().split('').reduce(
  (total, char) => total * 26 + char.charCodeAt(0) - 64,
  0,
);

export const parseA1Range = (value, { maxColumns = MAX_SHEET_COLUMNS } = {}) => {
  const match = /^([A-Z]{1,3})(\d+):([A-Z]{1,3})(\d+)$/i.exec(String(value ?? '').trim());
  if (!match) throw invalidRange();
  const startColumn = columnNumber(match[1]);
  const endColumn = columnNumber(match[3]);
  const startRow = Number(match[2]);
  const endRow = Number(match[4]);
  if (![startColumn, endColumn, startRow, endRow].every((item) => Number.isInteger(item) && item > 0)
    || startColumn > endColumn || startRow > endRow || endColumn > maxColumns) throw invalidRange('Google Sheet range is outside the allowed bounds.');
  return { startColumn, endColumn, startRow, endRow };
};

export const a1RangeFrom = ({ startColumn, endColumn, startRow, endRow }) => (
  `${columnName(startColumn)}${startRow}:${columnName(endColumn)}${endRow}`
);

export const splitA1RangeIntoBatches = ({
  range,
  maxRowsPerBatch = DEFAULT_MAX_ROWS_PER_BATCH,
  headerRow = 1,
  maxColumns = MAX_SHEET_COLUMNS,
} = {}) => {
  if (!Number.isInteger(maxRowsPerBatch) || maxRowsPerBatch < 1) throw invalidRange('Maximum rows per batch is invalid.');
  if (!Number.isInteger(headerRow) || headerRow < 1) throw invalidRange('Header row is invalid.');
  const parsed = parseA1Range(range, { maxColumns });
  if (headerRow < parsed.startRow || headerRow > parsed.endRow) throw invalidRange('Header row must be inside the configured range.');
  const batches = [];
  for (let startRow = parsed.startRow; startRow <= parsed.endRow; startRow += maxRowsPerBatch) {
    const endRow = Math.min(parsed.endRow, startRow + maxRowsPerBatch - 1);
    batches.push({
      range: a1RangeFrom({ ...parsed, startRow, endRow }),
      startRow,
      endRow,
      rowCount: endRow - startRow + 1,
      includesHeader: headerRow >= startRow && headerRow <= endRow,
    });
  }
  return batches;
};

export const sampleA1Range = ({ range, headerRow = 1, maxRows = 20, maxColumns = MAX_SHEET_COLUMNS } = {}) => {
  if (!Number.isInteger(maxRows) || maxRows < 1) throw invalidRange('Sample row count is invalid.');
  const parsed = parseA1Range(range, { maxColumns });
  if (!Number.isInteger(headerRow) || headerRow < parsed.startRow || headerRow > parsed.endRow) throw invalidRange('Header row must be inside the configured range.');
  return a1RangeFrom({
    ...parsed,
    startRow: headerRow,
    endRow: Math.min(parsed.endRow, headerRow + maxRows - 1),
  });
};
