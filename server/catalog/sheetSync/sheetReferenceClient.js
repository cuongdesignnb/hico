import { createSign } from 'node:crypto';
import { SheetSyncError } from './sheetSyncTypes.js';

const scope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const quoteSheetTitle = (title) => `'${String(title).replace(/'/g, "''")}'`;
const requiredConfig = (env) => ['CATALOG_SHEET_ID', 'CATALOG_SHEET_TAB', 'CATALOG_SHEET_RANGE', 'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON']
  .filter((key) => !env[key]);

const serviceToken = async ({ account, fetchImpl, now }) => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({ iss: account.client_email, scope, aud: account.token_uri ?? 'https://oauth2.googleapis.com/token', iat: Math.floor(now() / 1000), exp: Math.floor(now() / 1000) + 300 })).toString('base64url');
  const signer = createSign('RSA-SHA256'); signer.update(`${header}.${claim}`); signer.end();
  const assertion = `${header}.${claim}.${signer.sign(account.private_key, 'base64url')}`;
  const response = await fetchImpl(account.token_uri ?? 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!response.ok) throw new SheetSyncError('Google Sheets authorization failed.', { code: 'SHEET_AUTH_FAILED', status: 502 });
  return (await response.json()).access_token;
};

export const createSheetReferenceClient = ({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) => ({
  async readRows() {
    const missing = requiredConfig(env);
    if (missing.length) throw new SheetSyncError('Google Sheet synchronization is not configured.', { code: 'SHEET_SYNC_NOT_CONFIGURED', status: 503, details: { missing } });
    let account;
    try { account = JSON.parse(env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON); } catch { throw new SheetSyncError('Google Sheet service account is invalid.', { code: 'SHEET_SERVICE_ACCOUNT_INVALID', status: 503 }); }
    const token = await serviceToken({ account, fetchImpl, now });
    const reference = `${quoteSheetTitle(env.CATALOG_SHEET_TAB)}!${env.CATALOG_SHEET_RANGE}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.CATALOG_SHEET_ID)}/values/${encodeURIComponent(reference)}?majorDimension=ROWS`;
    const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new SheetSyncError('Google Sheet could not be read.', { code: 'SHEET_FETCH_FAILED', status: 502 });
    const body = await response.json();
    return { spreadsheetId: env.CATALOG_SHEET_ID, sheetTab: env.CATALOG_SHEET_TAB, sheetRange: env.CATALOG_SHEET_RANGE, values: Array.isArray(body.values) ? body.values : [] };
  },
});
