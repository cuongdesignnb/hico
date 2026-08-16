import { GoogleSheetSettingsError, maskSpreadsheetId } from './googleSheetSecretCrypto.js';
import { validateSimHicoHeader } from '../../catalog/sheetSync/simHicoHeaderAliases.js';
import { HICO_GOC_SHEET, hicoGocHeaderHash } from '../../catalog/sheetSync/hicoGocMapping.js';

const MAX_HEADER_ROW = 100;
const MAX_HEADER_COLUMNS = 52;
const MAX_SAMPLE_ROWS = 20;
const REQUIRED_HEADERS = ['retail_price', 'currency', 'wmproduct_id', 'apn', 'network_label', 'public_note'];
const MATCH_HEADERS = [['variant_id'], ['product_slug', 'sku']];

export const quoteSheetTitle = (title) => `'${String(title).replace(/'/g, "''")}'`;

const columnName = (number) => {
  let result = '';
  for (let value = number; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  return result;
};

const parseA1 = (value) => {
  const match = /^([A-Z]{1,3})(\d+):([A-Z]{1,3})(\d+)$/i.exec(String(value ?? '').trim());
  if (!match) throw new GoogleSheetSettingsError('Google Sheet range is invalid.', { code: 'GOOGLE_SHEET_RANGE_INVALID', status: 422 });
  const col = (input) => input.toUpperCase().split('').reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
  const startColumn = col(match[1]);
  const endColumn = col(match[3]);
  const startRow = Number(match[2]);
  const endRow = Number(match[4]);
  if (startColumn > endColumn || startRow > endRow || endColumn > MAX_HEADER_COLUMNS || endRow - startRow + 1 > 5000) throw new GoogleSheetSettingsError('Google Sheet range is outside the allowed bounds.', { code: 'GOOGLE_SHEET_RANGE_INVALID', status: 422 });
  return { startColumn, endColumn, startRow, endRow };
};

const mapMetadata = (raw) => ({
  spreadsheetIdMasked: maskSpreadsheetId(raw.spreadsheetId),
  title: raw.properties?.title ?? null,
  locale: raw.properties?.locale ?? null,
  timeZone: raw.properties?.timeZone ?? null,
  sheets: (Array.isArray(raw.sheets) ? raw.sheets : []).map(({ properties = {} }) => ({
    sheetId: properties.sheetId,
    title: properties.title,
    index: properties.index,
    sheetType: properties.sheetType,
    rowCount: properties.gridProperties?.rowCount ?? 0,
    columnCount: properties.gridProperties?.columnCount ?? 0,
    frozenRowCount: properties.gridProperties?.frozenRowCount ?? 0,
    frozenColumnCount: properties.gridProperties?.frozenColumnCount ?? 0,
  })).filter((sheet) => sheet.sheetType === 'GRID'),
});

const headerResult = ({ metadata, sheet, headerRow, values }) => {
  const headers = Array.isArray(values[0]) ? values[0].map((value) => String(value ?? '').trim()).slice(0, MAX_HEADER_COLUMNS) : [];
  while (headers.at(-1) === '') headers.pop();
  const normalized = headers.map((header) => header.toLowerCase());
  const warnings = [];
  const duplicates = normalized.filter((header, index) => header && normalized.indexOf(header) !== index);
  if (duplicates.length) warnings.push({ code: 'DUPLICATE_HEADERS', headers: [...new Set(duplicates)] });
  const isHicoGoc = sheet.title === HICO_GOC_SHEET;
  const simHico = validateSimHicoHeader(headers);
  const legacy = MATCH_HEADERS.some((group) => group.every((header) => normalized.includes(header)));
  if (!isHicoGoc && !simHico.valid && !legacy) throw new GoogleSheetSettingsError('Google Sheet headers are invalid.', { code: 'SHEET_HEADER_CONTRACT_INVALID', status: 422, details: { missing: simHico.missing, required: MATCH_HEADERS } });
  const missing = isHicoGoc || simHico.valid ? [] : REQUIRED_HEADERS.filter((header) => !normalized.includes(header) && !(header === 'network_label' && normalized.includes('network')));
  if (missing.length) warnings.push({ code: 'MISSING_OPTIONAL_HEADERS', headers: missing });
  const endRow = simHico.valid ? Math.min(20, sheet.rowCount || 20) : Math.min(5000, sheet.rowCount || 5000);
  return { sheetId: sheet.sheetId, sheetTitle: sheet.title, headerRow, headers: headers.filter(Boolean), headerHash: hicoGocHeaderHash(headers), suggestedRange: `A${headerRow}:${columnName(Math.max(1, headers.length))}${endRow}`, warnings, spreadsheetIdMasked: metadata.spreadsheetIdMasked, contract: isHicoGoc ? 'HICO_GOC_QUICK_SYNC' : simHico.valid ? 'SIM_HICO_NATIVE' : 'LEGACY', detectedAliases: simHico.valid ? simHico.detectedAliases : {} };
};

export const createGoogleSheetDiscoveryService = ({ clientFactory, resolveCredential, now = () => new Date() } = {}) => ({
  async getSpreadsheetMetadata({ spreadsheetId }) {
    const id = String(spreadsheetId ?? '').trim();
    if (!id || id.length > 200) throw new GoogleSheetSettingsError('Spreadsheet ID is invalid.', { code: 'GOOGLE_SHEET_NOT_FOUND', status: 422 });
    const raw = await clientFactory.getSpreadsheet({ credential: await resolveCredential(), spreadsheetId: id });
    return mapMetadata({ ...raw, spreadsheetId: id });
  },
  async readHeader({ spreadsheetId, sheetId, sheetTitle, headerRow = 1, maxColumns = MAX_HEADER_COLUMNS }) {
    const metadata = await this.getSpreadsheetMetadata({ spreadsheetId });
    const sheet = metadata.sheets.find((item) => (sheetId !== undefined && item.sheetId === Number(sheetId)) || item.title === sheetTitle);
    if (!sheet) throw new GoogleSheetSettingsError('Google Sheet tab was not found.', { code: 'GOOGLE_SHEET_TAB_NOT_FOUND', status: 422 });
    const row = Number(headerRow);
    if (!Number.isInteger(row) || row < 1 || row > MAX_HEADER_ROW || row > sheet.rowCount) throw new GoogleSheetSettingsError('Header row is invalid.', { code: 'GOOGLE_SHEET_HEADER_INVALID', status: 422 });
    const end = columnName(Math.min(MAX_HEADER_COLUMNS, Math.max(1, Number(maxColumns) || MAX_HEADER_COLUMNS)));
    const values = await clientFactory.getValues({ credential: await resolveCredential(), range: `${spreadsheetId}!${quoteSheetTitle(sheet.title)}!A${row}:${end}${Math.min(sheet.rowCount || row + MAX_SAMPLE_ROWS, row + MAX_SAMPLE_ROWS - 1)}` });
    return headerResult({ metadata, sheet, headerRow: row, values });
  },
  validateRange({ metadata, sheetTitle, range, headerRow = 1, maxRowsPerBatch = 5000 }) {
    const sheet = metadata.sheets.find((item) => item.title === sheetTitle);
    if (!sheet) throw new GoogleSheetSettingsError('Google Sheet tab was not found.', { code: 'GOOGLE_SHEET_TAB_NOT_FOUND', status: 422 });
    const parsed = parseA1(range);
    if (parsed.endRow > Math.min(sheet.rowCount || parsed.endRow, headerRow + maxRowsPerBatch - 1) || parsed.startRow > headerRow || parsed.endRow < headerRow || parsed.endColumn > sheet.columnCount) throw new GoogleSheetSettingsError('Google Sheet range is outside the allowed bounds.', { code: 'GOOGLE_SHEET_RANGE_INVALID', status: 422 });
    return { valid: true, sheetTitle, range, headerRow, checkedAt: now().toISOString() };
  },
});

export { MAX_HEADER_COLUMNS, parseA1 };
