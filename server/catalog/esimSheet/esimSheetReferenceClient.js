import { createSign } from 'node:crypto';
import { ESIM_SHEET_SOURCE } from './esimSheetSource.js';

const scope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const quoteTitle = (title) => `'${String(title).replace(/'/g, "''")}'`;

const requiredKeys = ['ESIM_SHEET_ID', 'ESIM_SHEET_TAB', 'ESIM_SHEET_RANGE', 'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON'];

const tokenFor = async ({ account, fetchImpl, now }) => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const nowSeconds = Math.floor(now() / 1000);
  const claim = Buffer.from(JSON.stringify({
    iss: account.client_email,
    scope,
    aud: account.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 300,
  })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const assertion = `${header}.${claim}.${signer.sign(account.private_key, 'base64url')}`;
  const response = await fetchImpl(account.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) throw Object.assign(new Error('Google Sheets authorization failed.'), { code: 'ESIM_SHEET_AUTH_FAILED', status: 502 });
  return (await response.json()).access_token;
};

export const createEsimSheetReferenceClient = ({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) => ({
  async readRows() {
    const missing = requiredKeys.filter((key) => !String(env[key] ?? '').trim());
    if (missing.length) throw Object.assign(new Error('eSIM Sheet source is not configured.'), { code: 'ESIM_SHEET_NOT_CONFIGURED', status: 503, details: { missing } });
    let account;
    try {
      account = JSON.parse(env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON);
    } catch {
      throw Object.assign(new Error('Google Sheets service account is invalid.'), { code: 'ESIM_SHEET_CREDENTIAL_INVALID', status: 503 });
    }
    const token = await tokenFor({ account, fetchImpl, now });
    const reference = `${quoteTitle(env.ESIM_SHEET_TAB)}!${env.ESIM_SHEET_RANGE}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.ESIM_SHEET_ID)}/values/${encodeURIComponent(reference)}?majorDimension=ROWS`;
    const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw Object.assign(new Error('eSIM Sheet could not be read.'), { code: 'ESIM_SHEET_FETCH_FAILED', status: 502 });
    const body = await response.json();
    return {
      source: ESIM_SHEET_SOURCE,
      spreadsheetId: env.ESIM_SHEET_ID,
      sheetTab: env.ESIM_SHEET_TAB,
      sheetRange: env.ESIM_SHEET_RANGE,
      values: Array.isArray(body.values) ? body.values : [],
    };
  },
});

export const esimSheetConfigStatus = (env = process.env) => {
  const missing = requiredKeys.filter((key) => !String(env[key] ?? '').trim());
  return { configured: missing.length === 0, missing, source: ESIM_SHEET_SOURCE };
};
