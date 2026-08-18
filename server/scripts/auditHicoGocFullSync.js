import fs from 'node:fs/promises';
import { createSheetReferenceClient } from '../catalog/sheetSync/sheetReferenceClient.js';
import { collapseHicoGocRows, parseHicoGocRowsWithDiagnostics } from '../catalog/sheetSync/hicoGocParser.js';
import { buildFullSyncCandidate } from '../catalog/sheetSync/catalogResyncService.js';
import { assertFullSyncCandidate, fullSyncDiagnostics } from '../catalog/sheetSync/catalogResyncDiagnostics.js';
import { HICO_GOC_SHEET, normalizeHicoGocSettings, validateHicoGocRange } from '../catalog/sheetSync/hicoGocMapping.js';
import { cloneSeedCategories } from '../catalog/categories/catalogCategories.js';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { createProviderOfferRepository } from '../providers/providerOfferRepository.js';

const safeError = (error) => {
  const reasonCode = error?.code ?? 'READ_ONLY_REAL_SHEET_AUDIT_BLOCKED';
  const blockedCodes = new Set(['SHEET_SYNC_NOT_CONFIGURED', 'SHEET_SERVICE_ACCOUNT_INVALID', 'GOOGLE_SHEET_NOT_CONFIGURED', 'GOOGLE_SHEET_SETTINGS_REQUIRED']);
  return blockedCodes.has(reasonCode)
    ? { code: 'READ_ONLY_REAL_SHEET_AUDIT_BLOCKED', reasonCode, details: error?.details ?? undefined }
    : { code: reasonCode, details: error?.details ?? undefined };
};

const loadEnvironment = async () => {
  if (process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_APPLICATION_CREDENTIALS) return process.env;
  const credential = await fs.readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
  return { ...process.env, GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON: credential };
};

const run = async () => {
  const env = await loadEnvironment();
  const reference = await createSheetReferenceClient({ env }).readRows();
  if (String(reference.sheetTab ?? '').normalize('NFC').trim() !== HICO_GOC_SHEET) throw Object.assign(new Error('Wrong Sheet tab.'), { code: 'SHEET_SOURCE_TAB_INVALID' });
  const settings = normalizeHicoGocSettings({
    fieldMapping: env.HICO_GOC_FIELD_MAPPING_JSON ? JSON.parse(env.HICO_GOC_FIELD_MAPPING_JSON) : undefined,
    priceMapping: env.HICO_GOC_PRICE_MAPPING_JSON ? JSON.parse(env.HICO_GOC_PRICE_MAPPING_JSON) : undefined,
  });
  const range = validateHicoGocRange({ sheetRange: reference.sheetRange, headers: reference.values?.[0] ?? [], fieldMapping: settings.fieldMapping });
  const parsed = parseHicoGocRowsWithDiagnostics(reference.values, settings);
  const current = await createCanonicalCatalogRepository().readCatalog({ required: true });
  const offers = await createProviderOfferRepository().listOffers();
  const previousCatalog = current.products.length > 0 ? current : { products: [], variants: [], categories: current.categories ?? cloneSeedCategories(), manifest: null };
  const candidate = await buildFullSyncCandidate({ rows: collapseHicoGocRows(parsed.rows), categories: current.categories ?? cloneSeedCategories(), offers, previousCatalog });
  const diagnostics = fullSyncDiagnostics({ reference, range, parser: parsed.diagnostics, candidate, baselineCatalog: previousCatalog });
  assertFullSyncCandidate(diagnostics);
  return { status: 'ok', ...diagnostics };
};

try {
  console.log(JSON.stringify(await run(), null, 2));
} catch (error) {
  console.log(JSON.stringify({ status: 'blocked', ...safeError(error) }, null, 2));
  process.exitCode = 1;
}
