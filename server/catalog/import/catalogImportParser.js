import { CatalogWriteError } from '../write/catalogWriteValidation.js';

const MAX_ROWS = 3000;
const MAX_INPUT_LENGTH = 2_000_000;

const parseDelimited = (input, delimiter) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(field); field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field); field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else field += character;
  }
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  if (quoted) throw new CatalogWriteError('Dữ liệu Sheet có dấu ngoặc kép chưa đóng.', { code: 'IMPORT_PARSE_ERROR' });
  return rows;
};

export const parseCatalogImportText = (input) => {
  if (typeof input !== 'string' || !input.trim()) throw new CatalogWriteError('Hãy dán dữ liệu có hàng tiêu đề.', { code: 'IMPORT_EMPTY' });
  if (input.length > MAX_INPUT_LENGTH) throw new CatalogWriteError('Dữ liệu import vượt quá giới hạn 2MB.', { code: 'IMPORT_TOO_LARGE' });
  const firstLine = input.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const matrix = parseDelimited(input.replace(/^\uFEFF/, ''), delimiter);
  if (matrix.length < 2) throw new CatalogWriteError('Import cần header và ít nhất một dòng dữ liệu.', { code: 'IMPORT_NO_ROWS' });
  if (matrix.length - 1 > MAX_ROWS) throw new CatalogWriteError(`Import chỉ hỗ trợ tối đa ${MAX_ROWS} dòng.`, { code: 'IMPORT_TOO_MANY_ROWS' });
  const headers = matrix[0].map((value) => value.trim());
  if (headers.some((value) => !value)) throw new CatalogWriteError('Header không được để trống.', { code: 'IMPORT_HEADER_INVALID' });
  if (new Set(headers).size !== headers.length) throw new CatalogWriteError('Header không được trùng.', { code: 'IMPORT_HEADER_DUPLICATE' });
  return {
    headers,
    rows: matrix.slice(1).map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, (values[column] ?? '').trim()])),
    })),
  };
};

export const mapCatalogImportRows = ({ parsed, columnMap }) => {
  if (!columnMap || typeof columnMap !== 'object' || Array.isArray(columnMap)) throw new CatalogWriteError('columnMap không hợp lệ.', { code: 'IMPORT_COLUMN_MAP_INVALID' });
  const required = ['family', 'sku', 'dataLimit', 'duration', 'price'];
  for (const field of required) {
    if (typeof columnMap[field] !== 'string' || !parsed.headers.includes(columnMap[field])) throw new CatalogWriteError(`Chưa map cột ${field}.`, { code: 'IMPORT_COLUMN_MAP_REQUIRED', details: { field } });
  }
  const optional = ['compareAtPrice', 'coverageType', 'coverageId', 'productName'];
  for (const field of optional) {
    if (columnMap[field] && !parsed.headers.includes(columnMap[field])) throw new CatalogWriteError(`Cột ${field} không tồn tại.`, { code: 'IMPORT_COLUMN_MAP_INVALID', details: { field } });
  }
  return parsed.rows.map((row) => ({
    rowNumber: row.rowNumber,
    family: row.values[columnMap.family]?.normalize('NFC').trim(),
    productName: (columnMap.productName ? row.values[columnMap.productName] : row.values[columnMap.family])?.normalize('NFC').trim(),
    sku: row.values[columnMap.sku]?.trim(),
    dataLimit: row.values[columnMap.dataLimit]?.normalize('NFC').trim(),
    duration: row.values[columnMap.duration]?.normalize('NFC').trim(),
    price: row.values[columnMap.price]?.replace(/[,.\s]/g, ''),
    compareAtPrice: columnMap.compareAtPrice ? row.values[columnMap.compareAtPrice]?.replace(/[,.\s]/g, '') : '',
    coverageType: columnMap.coverageType ? row.values[columnMap.coverageType]?.trim() : '',
    coverageId: columnMap.coverageId ? row.values[columnMap.coverageId]?.trim() : '',
  }));
};
