import { createSign } from 'node:crypto';
import { GoogleSheetSettingsError } from './googleSheetSecretCrypto.js';
import { parseA1Range, sampleA1Range, splitA1RangeIntoBatches } from './googleSheetRangeBatches.js';

export const GOOGLE_SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

const tokenFor = async ({ credential, fetchImpl, now }) => {
  const issuedAt = Math.floor(now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: credential.client_email,
    scope: GOOGLE_SHEETS_READONLY_SCOPE,
    aud: credential.token_uri,
    iat: issuedAt,
    exp: issuedAt + 300,
  })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const assertion = `${header}.${claim}.${signer.sign(credential.private_key, 'base64url')}`;
  const response = await fetchImpl(credential.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) throw new GoogleSheetSettingsError('Google Sheet credential was rejected.', { code: 'GOOGLE_SHEET_CREDENTIAL_INVALID', status: 502 });
  const body = await response.json().catch(() => ({}));
  if (!body.access_token) throw new GoogleSheetSettingsError('Google Sheet credential was rejected.', { code: 'GOOGLE_SHEET_CREDENTIAL_INVALID', status: 502 });
  return body.access_token;
};

const responseError = (response, fallbackCode = 'GOOGLE_SHEET_CONNECTION_FAILED') => {
  if (response.status === 401 || response.status === 403) return new GoogleSheetSettingsError('Google Sheet permission was denied.', { code: 'GOOGLE_SHEET_PERMISSION_DENIED', status: 502 });
  if (response.status === 404) return new GoogleSheetSettingsError('Google Spreadsheet was not found.', { code: 'GOOGLE_SHEET_NOT_FOUND', status: 502 });
  if (response.status === 429) return new GoogleSheetSettingsError('Google Sheet rate limit was reached.', { code: 'GOOGLE_SHEET_RATE_LIMITED', status: 429 });
  return new GoogleSheetSettingsError('Google Sheet connection failed.', { code: fallbackCode, status: 502 });
};

const quoteSheetTitle = (title) => `'${String(title).replace(/'/g, "''")}'`;

const safeRange = (settings) => {
  if (!settings?.sheetName || !settings?.sheetRange) throw new GoogleSheetSettingsError('Google Sheet range is not configured.', { code: 'GOOGLE_SHEET_RANGE_INVALID' });
  if (settings.sheetName.length > 200 || settings.sheetRange.length > 200) throw new GoogleSheetSettingsError('Google Sheet range is invalid.', { code: 'GOOGLE_SHEET_RANGE_INVALID' });
  return `${quoteSheetTitle(settings.sheetName)}!${settings.sheetRange}`;
};

export const createGoogleSheetClientFactory = ({ fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) => ({
  async getSpreadsheet({ credential, spreadsheetId }) {
    const token = await tokenFor({ credential, fetchImpl, now });
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=false&fields=${encodeURIComponent('spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,sheetType,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)))')}`;
    const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw responseError(response);
    return response.json().catch(() => ({}));
  },
  async getValues({ credential, range }) {
    const token = await tokenFor({ credential, fetchImpl, now });
    const [spreadsheetId, ...rangeParts] = String(range).split('!');
    const a1 = rangeParts.join('!');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(a1)}?majorDimension=ROWS`;
    const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw responseError(response);
    const body = await response.json().catch(() => ({}));
    return Array.isArray(body.values) ? body.values : [];
  },
  async readRows({ credential, settings }) {
    safeRange(settings);
    const parsed = parseA1Range(settings.sheetRange);
    const batches = splitA1RangeIntoBatches({
      range: settings.sheetRange,
      maxRowsPerBatch: settings.maxRowsPerBatch,
      headerRow: settings.headerRow,
    });
    const values = [];
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      try {
        const batchValues = await this.getValues({ credential, range: `${settings.spreadsheetId}!${quoteSheetTitle(settings.sheetName)}!${batch.range}` });
        const rows = Array.isArray(batchValues) ? batchValues.slice(0, batch.rowCount) : [];
        values.push(...rows);
        while (rows.length < batch.rowCount) {
          rows.push([]);
          values.push([]);
        }
      } catch (error) {
        throw new GoogleSheetSettingsError('Google Sheet batch could not be read.', {
          code: 'SHEET_BATCH_FETCH_FAILED',
          status: error?.status ?? 502,
          details: { batchIndex: index + 1, batchCount: batches.length, range: batch.range },
        });
      }
    }
    const headerOffset = settings.headerRow - parsed.startRow;
    return {
      spreadsheetId: settings.spreadsheetId,
      sheetTab: settings.sheetName,
      sheetRange: settings.sheetRange,
      values: values.slice(headerOffset),
      batching: {
        logicalRange: settings.sheetRange,
        batchCount: batches.length,
        maxRowsPerBatch: settings.maxRowsPerBatch,
        rowsFetched: values.length,
      },
    };
  },
  async testConnection({ credential, settings }) {
    safeRange(settings);
    const metadata = await this.getSpreadsheet({ credential, spreadsheetId: settings.spreadsheetId });
    const names = Array.isArray(metadata.sheets) ? metadata.sheets.map((sheet) => sheet?.properties?.title).filter(Boolean) : [];
    if (settings.sheetName && names.length && !names.includes(settings.sheetName)) throw new GoogleSheetSettingsError('Google Sheet tab was not found.', { code: 'GOOGLE_SHEET_RANGE_INVALID', status: 422 });
    const sampleRange = sampleA1Range({
      range: settings.sheetRange,
      headerRow: settings.headerRow,
      maxRows: Math.min(20, settings.maxRowsPerBatch ?? 5000),
    });
    const values = await this.getValues({ credential, range: `${settings.spreadsheetId}!${quoteSheetTitle(settings.sheetName)}!${sampleRange}` });
    const headers = Array.isArray(values[0]) ? values[0].map((value) => String(value ?? '').trim()).filter(Boolean).slice(0, 32) : [];
    if (!headers.length) throw new GoogleSheetSettingsError('Google Sheet headers are invalid.', { code: 'GOOGLE_SHEET_HEADER_INVALID', status: 422 });
    return {
      spreadsheetTitle: metadata.properties?.title ?? null,
      sheetName: settings.sheetName,
      range: settings.sheetRange,
      headerColumns: headers,
      rowsSampled: Math.max(0, values.length - 1),
      checkedAt: new Date(now()).toISOString(),
    };
  },
});
