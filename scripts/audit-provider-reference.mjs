import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createGoogleSheetClientFactory } from '../server/integrations/googleSheets/googleSheetClientFactory.js';
import { validateServiceAccountCredential } from '../server/integrations/googleSheets/googleSheetSecretCrypto.js';
import {
  buildProviderReferenceRecords,
  discoverProviderReferences,
} from '../server/providers/providerReferenceDiscovery.js';

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetName = process.env.GOOGLE_SHEET_TAB ?? 'wm id goc';
const sheetRange = process.env.GOOGLE_SHEET_RANGE ?? 'A:AZ';
const credentialPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'service-account.json');
const targetWmproductIds = ['WM-e-CN-500MB-1D', 'WM-e-CN-500MB-2D'];

if (!spreadsheetId) {
  throw new Error('GOOGLE_SHEET_ID is required; no spreadsheet was guessed.');
}

const credential = validateServiceAccountCredential(JSON.parse(await readFile(credentialPath, 'utf8')));
const client = createGoogleSheetClientFactory();
const values = await client.getValues({
  credential,
  range: `${spreadsheetId}!'${sheetName.replaceAll("'", "''")}'!${sheetRange}`,
});
const [headers = [], ...rows] = values;
const records = buildProviderReferenceRecords({ headers, rows });
const preview = discoverProviderReferences(records, targetWmproductIds);

console.log(JSON.stringify({
  mode: 'READ_ONLY_PREVIEW',
  spreadsheetIdMasked: `${spreadsheetId.slice(0, 4)}…${spreadsheetId.slice(-4)}`,
  sheetName,
  sheetRange,
  targetWmproductIds,
  results: preview,
  requiresAdminConfirmationBeforePersist: true,
  persisted: false,
  sheetWriteback: false,
  worldmoveLiveQa: false,
}, null, 2));
