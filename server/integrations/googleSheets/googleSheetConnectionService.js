import { GoogleSheetSettingsError, maskSpreadsheetId, validateServiceAccountCredential } from './googleSheetSecretCrypto.js';
import { createGoogleSheetDiscoveryService } from './googleSheetDiscoveryService.js';
import { HICO_GOC_SHEET, normalizeHicoGocSettings } from '../../catalog/sheetSync/hicoGocMapping.js';

const ENV_KEYS = ['CATALOG_SHEET_ID', 'CATALOG_SHEET_TAB', 'CATALOG_SHEET_RANGE', 'GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON'];
const envConfigured = (env) => ENV_KEYS.every((key) => typeof env[key] === 'string' && env[key].trim());
const nowIso = () => new Date().toISOString();

const normalizedSettings = (value) => ({
  id: value?.id ?? 'catalog_google_sheet', enabled: Boolean(value?.enabled), credentialType: value?.credentialType ?? 'SERVICE_ACCOUNT',
  encryptedCredential: value?.encryptedCredential ?? null, credentialMasked: value?.credentialMasked ?? null,
  credentialFingerprint: value?.credentialFingerprint ?? null, encryptionKeyVersion: value?.encryptionKeyVersion ?? null,
  spreadsheetId: value?.spreadsheetId ?? null, sheetName: value?.sheetName ?? null, sheetRange: value?.sheetRange ?? null,
  headerRow: Number(value?.headerRow ?? 1), timezone: value?.timezone ?? 'Asia/Ho_Chi_Minh', referenceOnly: true,
  fieldMapping: value?.fieldMapping ?? null, priceMapping: value?.priceMapping ?? null, headerHash: value?.headerHash ?? null,
  requireApproval: true, allowClearToken: value?.allowClearToken !== false, clearToken: '__CLEAR__',
  maxRowsPerBatch: Math.min(5000, Math.max(1, Number(value?.maxRowsPerBatch ?? 5000))), syncTimeoutSeconds: Math.min(120, Math.max(1, Number(value?.syncTimeoutSeconds ?? 30))),
  scheduleEnabled: false, status: value?.status ?? 'DISABLED', lastTestStatus: value?.lastTestStatus ?? 'NOT_TESTED',
  lastTestErrorCode: value?.lastTestErrorCode ?? null, lastTestedAt: value?.lastTestedAt ?? null,
  createdAt: value?.createdAt ?? null, updatedAt: value?.updatedAt ?? null, updatedBy: value?.updatedBy ?? null, version: Number(value?.version ?? 1),
});

const publicSettings = (settings, { source = 'NONE', env = process.env } = {}) => {
  const current = normalizedSettings(settings);
  const configured = Boolean(current.encryptedCredential) || (source === 'ENVIRONMENT' && envConfigured(env));
  return {
    id: current.id,
    enabled: current.enabled && configured,
    credentialConfigured: configured,
    credentialType: current.credentialType,
    credentialFingerprint: current.credentialFingerprint ? `${current.credentialFingerprint.slice(0, 16)}…` : null,
    credentialMasked: current.credentialMasked ?? (source === 'ENVIRONMENT' ? 'ENVIRONMENT_CREDENTIAL' : null),
    spreadsheetIdMasked: maskSpreadsheetId(current.spreadsheetId ?? (source === 'ENVIRONMENT' ? env.CATALOG_SHEET_ID : null)),
    sheetName: current.sheetName ?? (source === 'ENVIRONMENT' ? env.CATALOG_SHEET_TAB : null),
    range: current.sheetRange ?? (source === 'ENVIRONMENT' ? env.CATALOG_SHEET_RANGE : null),
    headerRow: current.headerRow,
    fieldMapping: current.fieldMapping,
    priceMapping: current.priceMapping,
    headerHash: current.headerHash,
    timezone: current.timezone,
    referenceOnly: true,
    requireApproval: true,
    allowClearToken: current.allowClearToken,
    maxRowsPerBatch: current.maxRowsPerBatch,
    syncTimeoutSeconds: current.syncTimeoutSeconds,
    scheduleEnabled: false,
    status: configured ? current.status : source === 'ENVIRONMENT' ? 'CONFIGURED' : current.status,
    source,
    lastTestStatus: current.lastTestStatus,
    lastTestErrorCode: current.lastTestErrorCode,
    lastTestedAt: current.lastTestedAt,
    updatedAt: current.updatedAt,
    version: current.version,
  };
};

const sourceFor = (settings, env) => settings?.encryptedCredential ? 'ADMIN_SETTINGS' : envConfigured(env) ? 'ENVIRONMENT' : 'NONE';

const assertConnectionSettings = (input) => {
  const enabled = Boolean(input.enabled);
  const spreadsheetId = String(input.spreadsheetId ?? '').trim();
  const sheetName = String(input.sheetName ?? '').trim();
  const sheetRange = String(input.sheetRange ?? '').trim();
  const headerRow = Number(input.headerRow ?? 1);
  const maxRowsPerBatch = Number(input.maxRowsPerBatch ?? 5000);
  const syncTimeoutSeconds = Number(input.syncTimeoutSeconds ?? 30);
  if (enabled && (!spreadsheetId || !sheetName || !sheetRange)) throw new GoogleSheetSettingsError('Spreadsheet ID, sheet name and range are required.', { code: 'GOOGLE_SHEET_SETTINGS_INVALID' });
  if (!Number.isInteger(headerRow) || headerRow < 1) throw new GoogleSheetSettingsError('Header row is invalid.', { code: 'GOOGLE_SHEET_SETTINGS_INVALID' });
  if (!Number.isInteger(maxRowsPerBatch) || maxRowsPerBatch < 1 || maxRowsPerBatch > 5000) throw new GoogleSheetSettingsError('Maximum rows per batch is invalid.', { code: 'GOOGLE_SHEET_SETTINGS_INVALID' });
  if (!Number.isInteger(syncTimeoutSeconds) || syncTimeoutSeconds < 1 || syncTimeoutSeconds > 120) throw new GoogleSheetSettingsError('Sync timeout is invalid.', { code: 'GOOGLE_SHEET_SETTINGS_INVALID' });
  if (input.referenceOnly !== undefined && input.referenceOnly !== true) throw new GoogleSheetSettingsError('Sheet integration must remain reference-only.', { code: 'GOOGLE_SHEET_GUARDRAIL_REQUIRED' });
  if (input.requireApproval !== undefined && input.requireApproval !== true) throw new GoogleSheetSettingsError('Sheet integration must require Admin approval.', { code: 'GOOGLE_SHEET_GUARDRAIL_REQUIRED' });
  if (input.scheduleEnabled === true) throw new GoogleSheetSettingsError('Scheduled Sheet sync is not enabled.', { code: 'GOOGLE_SHEET_SCHEDULE_UNAVAILABLE' });
  const mapping = sheetName === HICO_GOC_SHEET
    ? normalizeHicoGocSettings({ fieldMapping: input.fieldMapping, priceMapping: input.priceMapping, headerHash: input.headerHash })
    : { fieldMapping: input.fieldMapping ?? null, priceMapping: input.priceMapping ?? null, headerHash: input.headerHash ?? null };
  return { enabled, spreadsheetId: spreadsheetId || null, sheetName: sheetName || null, sheetRange: sheetRange || null, headerRow, timezone: String(input.timezone ?? 'Asia/Ho_Chi_Minh').trim() || 'Asia/Ho_Chi_Minh', ...mapping, allowClearToken: input.allowClearToken !== false, maxRowsPerBatch, syncTimeoutSeconds };
};

export const createGoogleSheetConnectionService = ({ settingsRepository, credentialRepository, clientFactory, env = process.env, audit = () => {}, now = () => new Date() } = {}) => {
  const record = async ({ eventType, actorId, requestId, metadata = {} }) => {
    audit({ event: eventType.toLowerCase(), actorId, requestId, integration: 'catalog_google_sheet', ...metadata });
    await settingsRepository.appendEvent?.({ eventType, actorId, requestId, metadata });
  };
  const getSettings = async () => normalizedSettings(await settingsRepository.getSettings());
  const readPublicSettings = async () => {
    const settings = await getSettings();
    return publicSettings(settings, { source: sourceFor(settings, env), env });
  };
  const resolve = async ({ requireEnabled = true } = {}) => {
    const settings = await getSettings();
    const source = sourceFor(settings, env);
    if (source === 'NONE') throw new GoogleSheetSettingsError('Google Sheet is not configured.', { code: 'GOOGLE_SHEET_NOT_CONFIGURED', status: 503 });
    if (source === 'ADMIN_SETTINGS' && requireEnabled && !settings.enabled) throw new GoogleSheetSettingsError('Google Sheet integration is disabled.', { code: 'GOOGLE_SHEET_NOT_CONFIGURED', status: 503 });
    if (source === 'ADMIN_SETTINGS') return { settings, source, credential: await credentialRepository.decrypt(settings) };
    return {
      settings: { ...settings, enabled: true, spreadsheetId: env.CATALOG_SHEET_ID, sheetName: env.CATALOG_SHEET_TAB, sheetRange: env.CATALOG_SHEET_RANGE },
      source,
      credential: validateServiceAccountCredential(env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON),
    };
  };
  const resolveCredential = async () => {
    const settings = await getSettings();
    if (settings.encryptedCredential) return credentialRepository.decrypt(settings);
    if (env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON) return validateServiceAccountCredential(env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON);
    throw new GoogleSheetSettingsError('Google Sheet is not configured.', { code: 'GOOGLE_SHEET_NOT_CONFIGURED', status: 503 });
  };
  const discovery = createGoogleSheetDiscoveryService({ clientFactory, resolveCredential, now });
  return {
    async getPublicSettings() { return readPublicSettings(); },
    async saveSettings({ input, expectedVersion, actorId, requestId }) {
      const current = await getSettings();
      const changes = assertConnectionSettings({ ...current, ...(input ?? {}), spreadsheetId: input?.spreadsheetId ?? current.spreadsheetId, sheetName: input?.sheetName ?? current.sheetName, sheetRange: input?.sheetRange ?? current.sheetRange, fieldMapping: input?.fieldMapping ?? current.fieldMapping, priceMapping: input?.priceMapping ?? current.priceMapping, headerHash: input?.headerHash ?? current.headerHash });
      const saved = await settingsRepository.saveSettings({ changes, expectedVersion, actorId });
      await record({ eventType: 'GOOGLE_SHEET_SETTINGS_UPDATED', actorId, requestId, metadata: { version: saved.version, enabled: saved.enabled, source: 'ADMIN_SETTINGS' } });
      return publicSettings(saved, { source: sourceFor(saved, env), env });
    },
    async replaceCredential({ input, expectedVersion, actorId, requestId }) {
      const settings = await getSettings();
      const normalized = validateServiceAccountCredential(input?.credential ?? input);
      if (!settings.spreadsheetId || !settings.sheetName || !settings.sheetRange) throw new GoogleSheetSettingsError('Save Spreadsheet ID, sheet name and range before adding a credential.', { code: 'GOOGLE_SHEET_SETTINGS_REQUIRED', status: 422 });
      const candidate = { ...settings, encryptedCredential: null };
      const test = await clientFactory.testConnection({ credential: normalized, settings: candidate });
      const saved = await credentialRepository.replaceCredential({ credential: normalized, expectedVersion, actorId });
      const testedAt = now().toISOString();
      await settingsRepository.updateTestResult({ status: 'SUCCESS', errorCode: null, testedAt });
      await record({ eventType: settings.encryptedCredential ? 'GOOGLE_SHEET_CREDENTIAL_ROTATED' : 'GOOGLE_SHEET_CREDENTIAL_CREATED', actorId, requestId, metadata: { fingerprint: saved.credentialFingerprint?.slice(0, 16), testedAt } });
      return { settings: await readPublicSettings(), test: { ...test, checkedAt: testedAt } };
    },
    async testConnection({ input, actorId, requestId }) {
      const current = await getSettings();
      const hasCandidate = input && typeof input === 'object' && (input.spreadsheetId || input.sheetName || input.sheetRange || input.headerRow);
      const resolved = hasCandidate
        ? { settings: normalizedSettings({ ...current, ...input, spreadsheetId: input.spreadsheetId ?? current.spreadsheetId, sheetName: input.sheetName ?? current.sheetName, sheetRange: input.sheetRange ?? current.sheetRange }), source: current.encryptedCredential ? 'ADMIN_SETTINGS' : 'ENVIRONMENT', credential: await resolveCredential() }
        : await resolve({ requireEnabled: false });
      let result;
      try {
        result = await clientFactory.testConnection({ credential: resolved.credential ?? validateServiceAccountCredential(env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON), settings: resolved.settings });
        if (resolved.source === 'ADMIN_SETTINGS' && !hasCandidate) await settingsRepository.updateTestResult({ status: 'SUCCESS', errorCode: null, testedAt: result.checkedAt });
        await record({ eventType: 'GOOGLE_SHEET_CONNECTION_TESTED', actorId, requestId, metadata: { status: 'SUCCESS', source: resolved.source, rowsSampled: result.rowsSampled } });
        return { status: 'SUCCESS', source: resolved.source, ...result, settings: await readPublicSettings() };
      } catch (error) {
        if (resolved.source === 'ADMIN_SETTINGS' && !hasCandidate) await settingsRepository.updateTestResult({ status: 'FAILED', errorCode: error.code ?? 'GOOGLE_SHEET_CONNECTION_FAILED', testedAt: nowIso() });
        await record({ eventType: 'GOOGLE_SHEET_CONNECTION_TESTED', actorId, requestId, metadata: { status: 'FAILED', source: resolved.source, errorCode: error.code ?? 'GOOGLE_SHEET_CONNECTION_FAILED' } });
        throw error;
      }
    },
    async discoverSpreadsheet({ spreadsheetId, actorId, requestId }) {
      const result = await discovery.getSpreadsheetMetadata({ spreadsheetId });
      await record({ eventType: 'GOOGLE_SHEET_CONNECTION_TESTED', actorId, requestId, metadata: { status: 'DISCOVERED', spreadsheetIdMasked: result.spreadsheetIdMasked, sheetCount: result.sheets.length } });
      return result;
    },
    async discoverHeader({ spreadsheetId, sheetId, sheetTitle, headerRow, maxColumns, actorId, requestId }) {
      const result = await discovery.readHeader({ spreadsheetId, sheetId, sheetTitle, headerRow, maxColumns });
      await record({ eventType: 'GOOGLE_SHEET_CONNECTION_TESTED', actorId, requestId, metadata: { status: 'HEADER_DISCOVERED', spreadsheetIdMasked: result.spreadsheetIdMasked, sheetTitle: result.sheetTitle, headerRow: result.headerRow } });
      return result;
    },
    async validateRange({ spreadsheetId, sheetTitle, range, headerRow, maxRowsPerBatch }) {
      const metadata = await discovery.getSpreadsheetMetadata({ spreadsheetId });
      return discovery.validateRange({ metadata, sheetTitle, range, headerRow, maxRowsPerBatch });
    },
    async revokeCredential({ expectedVersion, actorId, requestId }) {
      const saved = await settingsRepository.revokeCredential({ expectedVersion, actorId });
      await record({ eventType: 'GOOGLE_SHEET_CREDENTIAL_REVOKED', actorId, requestId, metadata: { version: saved.version } });
      return publicSettings(saved, { source: sourceFor(saved, env), env });
    },
    async readRows() {
      const resolved = await resolve();
      const reference = await clientFactory.readRows({ credential: resolved.credential, settings: resolved.settings });
      return {
        ...reference,
        syncSettings: {
          fieldMapping: resolved.settings.fieldMapping,
          priceMapping: resolved.settings.priceMapping,
          headerHash: resolved.settings.headerHash,
          headerRow: resolved.settings.headerRow,
          maxRowsPerBatch: resolved.settings.maxRowsPerBatch,
        },
      };
    },
    publicSettings,
  };
};

export { assertConnectionSettings, publicSettings, envConfigured };
