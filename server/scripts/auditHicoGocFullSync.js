import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { createGoogleSheetSettingsRepository } from '../integrations/googleSheets/googleSheetSettingsRepository.js';
import { createGoogleSheetCredentialRepository } from '../integrations/googleSheets/googleSheetCredentialRepository.js';
import { createGoogleSheetClientFactory } from '../integrations/googleSheets/googleSheetClientFactory.js';
import { createGoogleSheetConnectionService } from '../integrations/googleSheets/googleSheetConnectionService.js';
import { maskSpreadsheetId } from '../integrations/googleSheets/googleSheetSecretCrypto.js';
import { collapseHicoGocRows, parseHicoGocRowsWithDiagnostics } from '../catalog/sheetSync/hicoGocParser.js';
import { buildFullSyncCandidate } from '../catalog/sheetSync/catalogResyncService.js';
import { assertFullSyncCandidate, fullSyncDiagnostics } from '../catalog/sheetSync/catalogResyncDiagnostics.js';
import { HICO_GOC_SHEET, hicoGocHeaderHash, normalizeHicoGocSettings, validateHicoGocRange } from '../catalog/sheetSync/hicoGocMapping.js';
import { SheetSyncError } from '../catalog/sheetSync/sheetSyncTypes.js';
import { cloneSeedCategories } from '../catalog/categories/catalogCategories.js';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { createProviderOfferRepository } from '../providers/providerOfferRepository.js';

const LEGACY_ENV_KEYS = [
  'CATALOG_SHEET_ID', 'CATALOG_SHEET_TAB', 'CATALOG_SHEET_RANGE',
  'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS',
  'HICO_GOC_FIELD_MAPPING_JSON', 'HICO_GOC_PRICE_MAPPING_JSON',
];

const knownBlockedCodes = new Set([
  'DATABASE_URL_REQUIRED', 'GOOGLE_SHEET_NOT_CONFIGURED', 'GOOGLE_SHEET_SETTINGS_UNAVAILABLE',
  'GOOGLE_SHEET_SETTINGS_REQUIRED', 'GOOGLE_SHEET_ENCRYPTION_KEY_REQUIRED',
  'GOOGLE_SHEET_SECRET_DECRYPT_FAILED', 'GOOGLE_SHEET_CREDENTIAL_INVALID',
  'GOOGLE_SHEET_CREDENTIAL_TOO_LARGE', 'GOOGLE_SHEET_PERMISSION_DENIED',
  'GOOGLE_SHEET_NOT_FOUND', 'GOOGLE_SHEET_RATE_LIMITED', 'GOOGLE_SHEET_CONNECTION_FAILED',
  'GOOGLE_SHEET_RANGE_INVALID', 'SHEET_FETCH_FAILED', 'SHEET_AUTH_FAILED',
  'SHEET_BATCH_FETCH_FAILED',
  'SHEET_SYNC_NOT_CONFIGURED', 'SHEET_SERVICE_ACCOUNT_INVALID',
  'SHEET_SOURCE_TAB_INVALID', 'SHEET_HEADER_REQUIRED', 'SHEET_HEADER_CHANGED',
  'SHEET_RANGE_INCOMPLETE', 'MAPPING_COLUMN_OUT_OF_RANGE', 'FULL_SYNC_SOURCE_EMPTY',
  'FULL_SYNC_EMPTY_CANDIDATE', 'FULL_SYNC_GROUPING_FAILED',
]);

const credentialUnavailableCodes = new Set([
  'GOOGLE_SHEET_ENCRYPTION_KEY_REQUIRED', 'GOOGLE_SHEET_SECRET_DECRYPT_FAILED',
  'GOOGLE_SHEET_CREDENTIAL_INVALID', 'GOOGLE_SHEET_CREDENTIAL_TOO_LARGE',
]);

const safeErrorKeys = new Set([
  'missing', 'configuredRange', 'requiredLastColumn', 'configuredLastColumn',
  'field', 'columnIndex', 'headerColumns', 'rowsRead', 'rowsParsed',
  'products', 'variants', 'diagnostics', 'reasonCode', 'batchIndex', 'batchCount', 'range',
  'provider', 'resolved', 'unresolved', 'ambiguous', 'inactive', 'needsReviewVariants',
]);

const sanitizeDetails = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeDetails);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => safeErrorKeys.has(key))
    .map(([key, nested]) => [key, sanitizeDetails(nested)]));
};

export const runtimeEnvironmentForAudit = ({ env = process.env, allowLegacyEnv = false } = {}) => {
  if (allowLegacyEnv) return { ...env };
  const runtimeEnv = { ...env };
  LEGACY_ENV_KEYS.forEach((key) => delete runtimeEnv[key]);
  return runtimeEnv;
};

const assertHicoGocReference = (reference, settings) => {
  if (String(reference.sheetTab ?? '').normalize('NFC').trim() !== HICO_GOC_SHEET) {
    throw new SheetSyncError(`Full sync yêu cầu tab ${HICO_GOC_SHEET}.`, { code: 'SHEET_SOURCE_TAB_INVALID', status: 422 });
  }
  const headers = reference.values?.[0];
  if (!Array.isArray(headers) || headers.length === 0) {
    throw new SheetSyncError('HICO GỐC không có header để đối chiếu mapping.', { code: 'SHEET_HEADER_REQUIRED', status: 422 });
  }
  const range = validateHicoGocRange({ sheetRange: reference.sheetRange, headers, fieldMapping: settings.fieldMapping });
  const headerHash = hicoGocHeaderHash(headers);
  if (settings.headerHash && settings.headerHash !== headerHash) {
    throw new SheetSyncError('HICO GỐC header đã thay đổi sau khi lưu mapping.', { code: 'SHEET_HEADER_CHANGED', status: 409 });
  }
  return { headers, range, headerHash };
};

export const runHicoGocFullSyncAudit = async ({
  env = process.env,
  allowLegacyEnv = false,
  poolFactory = createPostgresPool,
  settingsRepositoryFactory = ({ pool }) => createGoogleSheetSettingsRepository({ pool }),
  credentialRepositoryFactory = ({ settingsRepository, env: runtimeEnv }) => createGoogleSheetCredentialRepository({ settingsRepository, env: runtimeEnv }),
  clientFactoryFactory = () => createGoogleSheetClientFactory(),
  canonicalRepositoryFactory = () => createCanonicalCatalogRepository(),
  providerRepositoryFactory = () => createProviderOfferRepository(),
} = {}) => {
  const runtimeEnv = runtimeEnvironmentForAudit({ env, allowLegacyEnv });
  let pool = null;
  try {
    pool = await poolFactory({ env });
    const settingsRepository = settingsRepositoryFactory({ pool });
    const credentialRepository = credentialRepositoryFactory({ settingsRepository, env: runtimeEnv });
    const connectionService = createGoogleSheetConnectionService({
      settingsRepository,
      credentialRepository,
      clientFactory: clientFactoryFactory(),
      env: runtimeEnv,
    });
    const publicSettings = await connectionService.getPublicSettings();
    const reference = await connectionService.readRows();
    const settings = {
      ...normalizeHicoGocSettings(reference.syncSettings ?? {}),
      headerRow: Number(reference.syncSettings?.headerRow ?? publicSettings.headerRow ?? 1),
    };
    const validation = assertHicoGocReference(reference, settings);
    const parsed = parseHicoGocRowsWithDiagnostics(reference.values, settings);
    const canonicalRepository = canonicalRepositoryFactory();
    const providerRepository = providerRepositoryFactory();
    const current = await canonicalRepository.readCatalog({ required: true });
    const offers = await providerRepository.listOffers();
    const previousCatalog = current.products.length > 0
      ? current
      : { products: [], variants: [], categories: current.categories ?? cloneSeedCategories(), manifest: null };
    const candidate = await buildFullSyncCandidate({
      rows: collapseHicoGocRows(parsed.rows),
      categories: current.categories ?? cloneSeedCategories(),
      offers,
      previousCatalog,
    });
    const diagnostics = fullSyncDiagnostics({ reference, range: validation.range, parser: parsed.diagnostics, candidate, baselineCatalog: previousCatalog });
    assertFullSyncCandidate(diagnostics);
    return {
      status: 'ok',
      configSource: publicSettings.source,
      config: {
        configured: publicSettings.source !== 'NONE',
        credentialConfigured: publicSettings.credentialConfigured,
        spreadsheetIdMasked: maskSpreadsheetId(reference.spreadsheetId),
        sheetName: reference.sheetTab,
        range: reference.sheetRange,
        headerRow: publicSettings.headerRow,
        version: publicSettings.version,
      },
      source: {
        sheetName: reference.sheetTab,
        range: reference.sheetRange,
        headerRow: publicSettings.headerRow,
        headerColumns: validation.headers.length,
        rowsRead: diagnostics.source.rowsRead,
        logicalRange: reference.sheetRange,
        batching: reference.batching ?? null,
        batchCount: reference.batching?.batchCount ?? 1,
        rowsFetched: reference.batching?.rowsFetched ?? null,
        maxRowsPerBatch: reference.batching?.maxRowsPerBatch ?? null,
      },
      mapping: {
        valid: true,
        requiredLastColumn: diagnostics.source.requiredLastColumn,
        configuredLastColumn: diagnostics.source.configuredLastColumn,
        headerColumns: validation.headers.length,
        headerHashPresent: Boolean(settings.headerHash),
      },
      parser: {
        rowsParsed: diagnostics.parser.rowsParsed,
        rowsRejected: diagnostics.parser.rowsRejected,
        rejectionReasons: diagnostics.parser.rejectionReasons,
        topRejectionReasons: diagnostics.candidate.topRejectionReasons,
      },
      candidate: {
        products: diagnostics.candidate.products,
        variants: diagnostics.candidate.variants,
        validRows: diagnostics.candidate.validRows,
        uniqueProductKeys: diagnostics.candidate.uniqueProductKeys,
        packageFamilies: diagnostics.candidate.packageFamilies,
        exactDuplicatesCollapsed: diagnostics.candidate.exactDuplicatesCollapsed,
        groupingCollisions: diagnostics.candidate.groupingCollisions,
        operationUnresolved: diagnostics.candidate.operationUnresolved,
        operations: diagnostics.candidate.operations,
        mediums: diagnostics.candidate.mediums,
        coverageFilters: diagnostics.candidate.coverageFilters,
        sourceClassification: diagnostics.candidate.sourceClassification,
      },
      provider: diagnostics.provider,
      enrichment: {
        imagesReused: candidate.summary.imagesReused,
        imagesFromSheet: candidate.summary.imagesFromSheet,
        imagesFallback: candidate.summary.imagesFallback,
        descriptionsReused: candidate.summary.descriptionsReused,
        descriptionsFromSheet: candidate.summary.descriptionsFromSheet,
        descriptionsFallback: candidate.summary.descriptionsFallback,
        installationGuideReused: candidate.summary.installationGuideReused,
      },
      ...(diagnostics.sizeDropWarning ? { sizeDropWarning: diagnostics.sizeDropWarning } : {}),
    };
  } finally {
    await pool?.end?.();
  }
};

export const safeAuditError = (error) => {
  const reasonCode = error?.code ?? 'READ_ONLY_AUDIT_FAILED';
  const details = sanitizeDetails(error?.details);
  if (credentialUnavailableCodes.has(reasonCode)) {
    return { status: 'blocked', code: 'INTEGRATION_CREDENTIAL_UNAVAILABLE', reasonCode, ...(details ? { details } : {}) };
  }
  if (reasonCode === 'GOOGLE_SHEET_NOT_CONFIGURED' || reasonCode === 'GOOGLE_SHEET_SETTINGS_UNAVAILABLE' || reasonCode === 'DATABASE_URL_REQUIRED' || reasonCode === 'SHEET_SYNC_NOT_CONFIGURED') {
    return { status: 'blocked', code: 'READ_ONLY_REAL_SHEET_AUDIT_BLOCKED_LOCAL', reasonCode: 'SHEET_SYNC_NOT_CONFIGURED', ...(details ? { details } : {}) };
  }
  if (knownBlockedCodes.has(reasonCode)) {
    return { status: 'blocked', code: reasonCode, ...(details ? { details } : {}) };
  }
  return { status: 'error', code: 'READ_ONLY_AUDIT_FAILED', reasonCode };
};

export const auditMain = async ({ env = process.env, args = process.argv.slice(2), write = (value) => process.stdout.write(value), run = runHicoGocFullSyncAudit } = {}) => {
  try {
    const result = await run({ env, allowLegacyEnv: args.includes('--legacy-env') });
    write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    write(`${JSON.stringify(safeAuditError(error), null, 2)}\n`);
    return 1;
  }
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = await auditMain();
