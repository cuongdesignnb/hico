import { GoogleSheetSettingsError, maskSpreadsheetId } from './googleSheetSecretCrypto.js';
import { validateSimHicoHeader } from '../../catalog/sheetSync/simHicoHeaderAliases.js';
import { DEFAULT_HICO_GOC_FIELD_MAPPING, HICO_GOC_SHEET, hicoGocColumnName, hicoGocHeaderHash } from '../../catalog/sheetSync/hicoGocMapping.js';
import { columnName, parseA1Range, splitA1RangeIntoBatches } from './googleSheetRangeBatches.js';

const MAX_HEADER_ROW = 100;
const MAX_HEADER_COLUMNS = 52;
const MAX_SAMPLE_ROWS = 20;
const REQUIRED_HEADERS = ['retail_price', 'currency', 'wmproduct_id', 'apn', 'network_label', 'public_note'];
const MATCH_HEADERS = [['variant_id'], ['product_slug', 'sku']];

export const quoteSheetTitle = (title) => `'${String(title).replace(/'/g, "''")}'`;

const parseA1 = (value) => parseA1Range(value, { maxColumns: MAX_HEADER_COLUMNS });

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
  const headerColumn = columnName(Math.max(1, headers.length));
  const sampleEndRow = headerRow + Math.max(0, values.length - 1);
  const fullColumn = isHicoGoc
    ? hicoGocColumnName(Math.max(...Object.values(DEFAULT_HICO_GOC_FIELD_MAPPING)))
    : headerColumn;
  const fullEndRow = sheet.rowCount || sampleEndRow;
  const headerSampleRange = `A${headerRow}:${headerColumn}${sampleEndRow}`;
  const suggestedFullRange = `A${headerRow}:${fullColumn}${fullEndRow}`;
  return {
    sheetId: sheet.sheetId,
    sheetTitle: sheet.title,
    headerRow,
    headers: headers.filter(Boolean),
    headerHash: hicoGocHeaderHash(headers),
    headerSampleRange,
    suggestedFullRange,
    suggestedRange: suggestedFullRange,
    warnings,
    spreadsheetIdMasked: metadata.spreadsheetIdMasked,
    contract: isHicoGoc ? 'HICO_GOC_QUICK_SYNC' : simHico.valid ? 'SIM_HICO_NATIVE' : 'LEGACY',
    detectedAliases: simHico.valid ? simHico.detectedAliases : {},
  };
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
    if (!Number.isInteger(row) || row < 1 || row > MAX_HEADER_ROW || (sheet.rowCount > 0 && row > sheet.rowCount)) throw new GoogleSheetSettingsError('Header row is invalid.', { code: 'GOOGLE_SHEET_HEADER_INVALID', status: 422 });
    const end = columnName(Math.min(MAX_HEADER_COLUMNS, Math.max(1, Number(maxColumns) || MAX_HEADER_COLUMNS)));
    const values = await clientFactory.getValues({ credential: await resolveCredential(), range: `${spreadsheetId}!${quoteSheetTitle(sheet.title)}!A${row}:${end}${Math.min(sheet.rowCount || row + MAX_SAMPLE_ROWS, row + MAX_SAMPLE_ROWS - 1)}` });
    return headerResult({ metadata, sheet, headerRow: row, values });
  },
  validateRange({ metadata, sheetTitle, range, headerRow = 1, maxRowsPerBatch = 5000 }) {
    const sheet = metadata.sheets.find((item) => item.title === sheetTitle);
    if (!sheet) throw new GoogleSheetSettingsError('Google Sheet tab was not found.', { code: 'GOOGLE_SHEET_TAB_NOT_FOUND', status: 422 });
    const parsed = parseA1(range);
    const batches = splitA1RangeIntoBatches({ range, maxRowsPerBatch, headerRow, maxColumns: MAX_HEADER_COLUMNS });
    if ((sheet.rowCount > 0 && parsed.endRow > sheet.rowCount) || parsed.startRow > headerRow || parsed.endRow < headerRow || (sheet.columnCount > 0 && parsed.endColumn > sheet.columnCount)) throw new GoogleSheetSettingsError('Google Sheet range is outside the allowed bounds.', { code: 'GOOGLE_SHEET_RANGE_INVALID', status: 422 });
    return {
      valid: true,
      sheetTitle,
      range,
      headerRow,
      batching: {
        logicalRange: range,
        batchCount: batches.length,
        maxRowsPerBatch,
        rowsFetched: parsed.endRow - parsed.startRow + 1,
      },
      checkedAt: now().toISOString(),
    };
  },
});

export { MAX_HEADER_COLUMNS, parseA1 };
