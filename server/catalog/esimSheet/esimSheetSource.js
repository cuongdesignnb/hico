import { createHash } from 'node:crypto';
import { isWorldmoveEsimOffer } from '../fulfillment/fulfillmentContracts.js';

export const ESIM_SHEET_SOURCE = 'HICO_ESIM_SHEET';
export const ESIM_SHEET_PARSER_REVISION = 2;
export const SIM_HICO_SHEET_TAB = 'SimHICO';
export const SIM_HICO_ESIM_COLUMN_CONTRACT = Object.freeze({
  medium: 0,
  productName: 1,
  durationDays: 2,
  dataPolicy: 3,
  sellingPrice: 5,
  apn: 10,
  coverageLabel: 11,
  publicNote: 12,
  resetPolicy: 13,
  cancellable: 15,
  sku: 17,
  wmid: 24,
});

const HEADER_ALIASES = Object.freeze({
  medium: ['medium', 'loại sim', 'loai sim', 'sim type'],
  wmid: ['wmid', 'wm id', 'wmid esim', 'wm id esim', 'wmproductid', 'wm product id', 'worldmove id'],
  productName: ['product name', 'tên gói', 'ten goi', 'name'],
  sellingPrice: ['selling price', 'giá bán', 'gia ban', 'price'],
  durationDays: ['duration days', 'số ngày', 'so ngay', 'days'],
  tripDayOptions: ['trip day options', 'ngày chuyến đi', 'ngay chuyen di', 'trip days'],
  publicNote: ['public note', 'ghi chú', 'ghi chu', 'note'],
  familyKey: ['family key', 'package family', 'họ gói', 'ho goi', 'family'],
  dataLimit: ['data limit', 'dung lượng', 'dung luong', 'data'],
  dataPolicy: ['data policy', 'loại data', 'loai data', 'data type'],
  coverageId: ['coverage id', 'destination id', 'mã coverage', 'ma coverage'],
  coverageLabel: ['coverage', 'destination', 'quốc gia', 'quoc gia'],
  coverageType: ['coverage type', 'loại coverage', 'loai coverage'],
  speedLabel: ['speed', 'tốc độ', 'toc do'],
  networkLabel: ['network', 'nhà mạng', 'nha mang', 'carrier'],
  apn: ['apn'],
  activationPolicy: ['activation policy', 'kích hoạt', 'kich hoat'],
  resetPolicy: ['reset policy', 'mốc reset', 'moc reset', 'thời gian reset', 'thoi gian reset', 'reset'],
  cancellable: ['cancellable', 'được huỷ', 'duoc huy', 'cancelable'],
});

const normalizeHeader = (value) => String(value ?? '')
  .normalize('NFC')
  .trim()
  .toLocaleLowerCase('vi-VN')
  .replace(/[._-]+/g, ' ')
  .replace(/\s+/g, ' ');

const normalizeWmid = (value) => String(value ?? '').normalize('NFC').trim().toUpperCase();

export const sourceKeyForWmid = (wmid) => {
  const normalized = normalizeWmid(wmid);
  return normalized ? `${ESIM_SHEET_SOURCE}:WMID:${normalized}` : null;
};

export const assertSimHicoReference = (reference) => {
  const sheetTab = String(reference?.sheetTab ?? '').normalize('NFC').trim();
  if (sheetTab && sheetTab !== SIM_HICO_SHEET_TAB) {
    throw Object.assign(new Error(`eSIM source phải đọc tab ${SIM_HICO_SHEET_TAB}.`), { code: 'ESIM_SHEET_TAB_INVALID', status: 422 });
  }
  return reference;
};

const nonEmpty = (value) => {
  const normalized = String(value ?? '').normalize('NFC').trim();
  return normalized || null;
};

const normalizeMedium = (value) => {
  const normalized = nonEmpty(value)?.toLocaleLowerCase('vi-VN');
  if (normalized === 'esim' || normalized === 'e-sim') return 'esim';
  if (normalized === 'sim' || normalized === 'sim vật lý' || normalized === 'sim vat ly') return 'physical_sim';
  return nonEmpty(value);
};

const normalizeDataPolicy = (value) => {
  const normalized = nonEmpty(value)?.toLocaleLowerCase('vi-VN');
  if (normalized === 'chia ngày' || normalized === 'chia ngay' || normalized === 'daily') return 'daily';
  if (normalized === 'gói tổng' || normalized === 'goi tong' || normalized === 'total') return 'total';
  return nonEmpty(value);
};

const labelsFromProductName = (value, dataPolicy) => {
  const name = nonEmpty(value) ?? '';
  const matches = [...name.matchAll(/(\d+(?:[.,]\d+)?)\s*(KB|MB|GB|TB)\b/gi)];
  const unlimitedMatches = [...name.matchAll(/\b(?:unlimited(?:\s+data)?|không\s+giới\s+hạn)\b/gi)];
  const formatted = (match) => `${match[1].replace(',', '.')} ${match[2].toUpperCase()}`;
  const dailyMatches = matches.filter((match) => {
    const suffix = name.slice((match.index ?? 0) + match[0].length);
    return /^\s*(?:\/\s*|per\s+)(?:day|ngày)\b/i.test(suffix);
  });
  const totalMatches = matches.filter((match) => {
    const prefix = name.slice(0, match.index ?? 0);
    return /(?:tổng|total)\s*(?:dữ\s*liệu|data)?\s*[:,-]?\s*$/i.test(prefix);
  });
  let dataLimit;
  const errors = [];
  const warnings = [];
  if (unlimitedMatches.length > 0 && matches.length === 0) {
    dataLimit = 'Unlimited';
  } else if (unlimitedMatches.length > 0) {
    errors.push('DATA_LIMIT_AMBIGUOUS');
  } else if (dataPolicy === 'daily') {
    if (dailyMatches.length === 1) dataLimit = formatted(dailyMatches[0]);
    else if (dailyMatches.length > 1) errors.push('DATA_LIMIT_AMBIGUOUS');
  } else if (dataPolicy === 'total') {
    if (totalMatches.length === 1) dataLimit = formatted(totalMatches[0]);
    else if (totalMatches.length > 1) errors.push('DATA_LIMIT_AMBIGUOUS');
    else {
      const nonDailyMatches = matches.filter((match) => !dailyMatches.includes(match));
      if (nonDailyMatches.length === 1) dataLimit = formatted(nonDailyMatches[0]);
      else if (nonDailyMatches.length > 1) errors.push('DATA_LIMIT_AMBIGUOUS');
    }
  } else if (matches.length) {
    dataLimit = formatted(matches[0]);
  }
  if (!dataLimit && errors.length === 0) warnings.push('DATA_LIMIT_NOT_DECLARED');
  const speeds = [...name.matchAll(/(\d+)\s*kbps\b/gi)];
  const speed = speeds.length === 1 ? speeds[0][1] : undefined;
  return {
    ...(dataLimit ? { dataLimit } : {}),
    ...(speed ? { speedLabel: `${speed}kbps` } : {}),
    errors,
    warnings,
  };
};

const splitCoverageLabel = (value) => {
  const text = nonEmpty(value);
  if (!text) return { coverageLabel: null, networkLabel: null };
  const separator = text.indexOf(':');
  if (separator < 0) return { coverageLabel: null, networkLabel: text };
  return {
    coverageLabel: nonEmpty(text.slice(0, separator)),
    networkLabel: nonEmpty(text.slice(separator + 1)),
  };
};

const numberFrom = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value ?? '').replace(/[.,\s]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const listOfPositiveIntegers = (value) => [...new Set(
  String(value ?? '')
    .split(/[,;|]/)
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0),
)].sort((left, right) => left - right);

const durationFromProductName = (value) => {
  const match = nonEmpty(value)?.match(/(?:^|[,\s])(\d+)\s*(?:day|days|ngày)\b/i);
  const days = Number.parseInt(match?.[1] ?? '', 10);
  return Number.isInteger(days) && days > 0 ? days : null;
};

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const simHicoIndexes = (headers) => {
  const normalized = headers.map(normalizeHeader);
  const isSimHico = normalized[23] === 'wmid sim' && normalized[24] === 'wmid esim';
  return isSimHico ? {
    medium: 0,
    productName: 1,
    durationDays: 2,
    dataPolicy: 3,
    sellingPrice: 5,
    apn: 10,
    networkLabel: 11,
    publicNote: 12,
    resetPolicy: 13,
    cancellable: 15,
    wmid: 24,
  } : {};
};

const indexesFor = (headers, mapping = {}) => {
  const normalized = headers.map(normalizeHeader);
  const profile = simHicoIndexes(headers);
  return Object.fromEntries(Object.entries(HEADER_ALIASES).map(([field, aliases]) => {
    const explicit = mapping[field];
    if (Number.isInteger(explicit) && explicit >= 0) return [field, explicit];
    if (Number.isInteger(profile[field])) return [field, profile[field]];
    const index = normalized.findIndex((header) => aliases.includes(header));
    return [field, index];
  }));
};

export const parseEsimSheetRows = ({ values = [], mapping = {} } = {}) => {
  if (!Array.isArray(values) || values.length === 0) {
    return { headers: [], rows: [], errors: [{ code: 'ESIM_SHEET_EMPTY' }], headerHash: digest([]), source: ESIM_SHEET_SOURCE, parserRevision: ESIM_SHEET_PARSER_REVISION };
  }
  const headers = Array.isArray(values[0]) ? values[0].map((value) => String(value ?? '').normalize('NFC').trim()) : [];
  const indexes = indexesFor(headers, mapping);
  const errors = [];
  if (indexes.wmid < 0) errors.push({ code: 'ESIM_WMID_COLUMN_REQUIRED' });
  if (indexes.sellingPrice < 0) errors.push({ code: 'ESIM_SELLING_PRICE_COLUMN_REQUIRED' });
  const rows = values.slice(1).map((cells, index) => {
    const valueAt = (field) => Array.isArray(cells) ? cells[indexes[field]] : undefined;
    const wmid = normalizeWmid(valueAt('wmid'));
    const sellingPrice = numberFrom(valueAt('sellingPrice'));
    const rowErrors = [];
    if (!wmid) rowErrors.push('WMID_REQUIRED');
    if (!sellingPrice || sellingPrice <= 0) rowErrors.push('SELLING_PRICE_INVALID');
    const normalizedPolicy = normalizeDataPolicy(valueAt('dataPolicy'));
    const inferredLabels = labelsFromProductName(valueAt('productName'), normalizedPolicy);
    const coverage = splitCoverageLabel(valueAt('coverageLabel') ?? valueAt('networkLabel'));
    const sourceDays = numberFrom(valueAt('durationDays'));
    const durationDays = normalizedPolicy === 'total'
      ? durationFromProductName(valueAt('productName'))
      : sourceDays;
    if (normalizedPolicy === 'daily' && (!Number.isInteger(durationDays) || durationDays < 1)) rowErrors.push('DAILY_DURATION_INVALID');
    if (normalizedPolicy === 'total' && !durationDays) rowErrors.push('TOTAL_DURATION_AMBIGUOUS');
    const explicitDataLimit = nonEmpty(valueAt('dataLimit'));
    if (!explicitDataLimit) rowErrors.push(...inferredLabels.errors);
    const warnings = explicitDataLimit ? [] : [...inferredLabels.warnings];
    const tripDayOptions = normalizedPolicy === 'total'
      ? listOfPositiveIntegers(sourceDays)
      : listOfPositiveIntegers(valueAt('tripDayOptions'));
    const optional = {
      familyKey: nonEmpty(valueAt('familyKey')),
      dataLimit: nonEmpty(valueAt('dataLimit')) ?? inferredLabels.dataLimit,
      dataPolicy: normalizedPolicy,
      coverageId: nonEmpty(valueAt('coverageId')),
      coverageType: nonEmpty(valueAt('coverageType')),
      coverageLabel: coverage.coverageLabel,
      speedLabel: nonEmpty(valueAt('speedLabel')) ?? inferredLabels.speedLabel,
      networkLabel: coverage.networkLabel,
      apn: nonEmpty(valueAt('apn')),
      activationPolicy: nonEmpty(valueAt('activationPolicy')),
      resetPolicy: nonEmpty(valueAt('resetPolicy')),
      cancellable: nonEmpty(valueAt('cancellable')),
    };
    const medium = normalizeMedium(valueAt('medium'));
    return {
      sourceRowNumber: index + 2,
      ...(medium ? { medium } : {}),
      wmid,
      productName: nonEmpty(valueAt('productName')),
      sellingPrice,
      durationDays,
      tripDayOptions,
      publicNote: nonEmpty(valueAt('publicNote')),
      ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value != null)),
      errors: rowErrors,
      warnings,
    };
  }).filter((row) => row.wmid || row.productName || row.sellingPrice !== null);
  return {
    headers,
    rows,
    errors,
    headerHash: digest(headers),
    source: ESIM_SHEET_SOURCE,
    parserRevision: ESIM_SHEET_PARSER_REVISION,
  };
};

export const matchEsimProviderOffer = ({ wmid, providerOffers = [] } = {}) => {
  const normalized = normalizeWmid(wmid);
  if (!normalized) return { status: 'PROVIDER_NOT_FOUND', offer: null, candidates: [] };
  const candidates = providerOffers.filter((offer) => (
    offer?.provider === 'worldmove'
    && normalizeWmid(offer.wmproductId) === normalized
  ));
  const supported = candidates.filter(isWorldmoveEsimOffer);
  if (supported.length === 1) return { status: 'MATCHED', offer: supported[0], candidates: supported };
  if (supported.length > 1) return { status: 'PROVIDER_AMBIGUOUS', offer: null, candidates: supported };
  if (candidates.some((offer) => offer.providerProductType === 0 && typeof offer.leSIM === 'boolean' && offer.active !== true)) {
    return { status: 'PROVIDER_INACTIVE', offer: null, candidates };
  }
  if (candidates.length > 0) return { status: 'PROVIDER_PRODUCT_TYPE_UNSUPPORTED', offer: null, candidates };
  return { status: 'PROVIDER_NOT_FOUND', offer: null, candidates: [] };
};

const sameWmidPayload = (row, provider) => ({
  price: row.sellingPrice,
  dataPolicy: row.dataPolicy ?? null,
  dataLimit: row.dataLimit ?? null,
  coverageLabel: row.coverageLabel ?? null,
  coverageId: row.coverageId ?? null,
  coverageType: row.coverageType ?? null,
  apn: row.apn ?? null,
  networkLabel: row.networkLabel ?? null,
  speedLabel: row.speedLabel ?? null,
  resetPolicy: row.resetPolicy ?? null,
  cancellable: row.cancellable ?? null,
  durationDays: row.dataPolicy === 'daily' ? row.durationDays ?? null : null,
  providerOfferId: provider.offer?.id ?? null,
  leSIM: provider.offer?.leSIM ?? null,
  providerProductType: provider.offer?.providerProductType ?? null,
});

export const commercialPayloadFor = (row, provider = null) => sameWmidPayload(row, { offer: provider });

const stableJson = (value) => JSON.stringify(value, Object.keys(value).sort());

const sameWmidDiagnostics = (rows, providersByWmid) => {
  const groups = new Map();
  rows.filter((row) => row.wmid).forEach((row) => {
    const group = groups.get(row.wmid) ?? [];
    group.push(row);
    groups.set(row.wmid, group);
  });
  const duplicateGroups = [...groups.entries()].filter(([, group]) => group.length > 1);
  const metric = (selector) => duplicateGroups.filter(([, group]) => new Set(group.map((row) => selector(row, providersByWmid.get(row.wmid)))).size > 1).length;
  return {
    uniqueWmids: groups.size,
    duplicateWmidGroups: duplicateGroups.length,
    sameWmidSameCommercialPayload: duplicateGroups.filter(([, group]) => {
      const signatures = new Set(group.map((row) => stableJson(sameWmidPayload(row, providersByWmid.get(row.wmid)))));
      return signatures.size === 1;
    }).length,
    sameWmidDifferentPrice: metric((row) => row.sellingPrice),
    sameWmidDifferentData: metric((row) => `${row.dataPolicy ?? ''}|${row.dataLimit ?? ''}`),
    sameWmidDifferentDuration: metric((row) => row.durationDays),
    sameWmidDifferentCoverageNetwork: metric((row) => `${row.coverageLabel ?? ''}|${row.coverageId ?? ''}|${row.networkLabel ?? ''}|${row.apn ?? ''}`),
    sameWmidDifferentLeSIMProviderMetadata: metric((_row, provider) => `${provider?.offer?.id ?? ''}|${provider?.offer?.leSIM ?? ''}|${provider?.offer?.providerProductType ?? ''}`),
    samples: duplicateGroups.slice(0, 20).map(([wmid, group]) => ({
      wmid,
      sourceRowNumbers: group.map((row) => row.sourceRowNumber),
      payloads: [...new Set(group.map((row) => stableJson(sameWmidPayload(row, providersByWmid.get(wmid)))))].length,
    })),
  };
};

export const auditEsimSheetRows = ({ values = [], mapping = {}, providerOffers = [], existingVariants = [] } = {}) => {
  const parsed = parseEsimSheetRows({ values, mapping });
  const rows = parsed.rows.map((row) => {
    if (row.medium !== 'esim') {
      return {
        sourceRowNumber: row.sourceRowNumber,
        wmid: row.wmid,
        sellingPrice: row.sellingPrice,
        providerStatus: 'SKIPPED_NON_ESIM',
        providerOfferId: null,
        providerProductType: null,
        leSIM: null,
        dataLimit: row.dataLimit ?? null,
        dataPolicy: row.dataPolicy ?? null,
        warnings: [...(row.warnings ?? [])],
        structuralErrors: [],
        errors: [],
      };
    }
    const provider = matchEsimProviderOffer({ wmid: row.wmid, providerOffers });
    return {
      sourceRowNumber: row.sourceRowNumber,
      wmid: row.wmid,
      sellingPrice: row.sellingPrice,
      providerStatus: provider.status,
      providerOfferId: provider.offer?.id ?? null,
      providerProductType: provider.offer?.providerProductType ?? null,
      leSIM: provider.offer?.leSIM ?? null,
      dataLimit: row.dataLimit ?? null,
      dataPolicy: row.dataPolicy ?? null,
      warnings: [...(row.warnings ?? [])],
      structuralErrors: [...row.errors],
      errors: [...row.errors, ...(provider.status === 'MATCHED' ? [] : [provider.status])],
    };
  });
  const providersByWmid = new Map(rows.map((row) => [row.wmid, matchEsimProviderOffer({ wmid: row.wmid, providerOffers })]));
  const statusCounts = Object.fromEntries([...new Set(rows.map((row) => row.providerStatus))].map((status) => [status, rows.filter((row) => row.providerStatus === status).length]));
  const legacyCollisionRows = rows
    .filter((row) => row.providerStatus !== 'SKIPPED_NON_ESIM')
    .filter((row) => existingVariants.some((variant) => normalizeWmid(variant.wmproductId) === row.wmid && variant.source !== ESIM_SHEET_SOURCE));
  const legacyWmidCollisions = legacyCollisionRows
    .slice(0, 20)
    .map((row) => ({ wmid: row.wmid, sourceRowNumber: row.sourceRowNumber }));
  const esimRows = parsed.rows.filter((row) => row.medium === 'esim');
  const structuralBlockedRows = rows.filter((row) => row.providerStatus !== 'SKIPPED_NON_ESIM' && row.structuralErrors.length > 0);
  return {
    source: ESIM_SHEET_SOURCE,
    parserRevision: ESIM_SHEET_PARSER_REVISION,
    headerHash: parsed.headerHash,
    rowsRead: rows.length,
    esimRows: esimRows.length,
    nonEsimRows: parsed.rows.filter((row) => row.medium !== 'esim').length,
    skippedNonEsimRows: rows.filter((row) => row.providerStatus === 'SKIPPED_NON_ESIM').length,
    missingWmid: esimRows.filter((row) => row.errors.includes('WMID_REQUIRED')).length,
    invalidPrice: esimRows.filter((row) => row.errors.includes('SELLING_PRICE_INVALID')).length,
    invalidDataPolicy: esimRows.filter((row) => row.dataPolicy && !['daily', 'total'].includes(row.dataPolicy)).length,
    dailyDurationInvalid: esimRows.filter((row) => row.dataPolicy === 'daily' && (!Number.isInteger(row.durationDays) || row.durationDays < 1)).length,
    totalDurationAmbiguous: esimRows.filter((row) => row.errors.includes('TOTAL_DURATION_AMBIGUOUS')).length,
    dataLimitAmbiguous: esimRows.filter((row) => row.errors.includes('DATA_LIMIT_AMBIGUOUS')).length,
    dataLimitNotDeclared: esimRows.filter((row) => row.warnings?.includes('DATA_LIMIT_NOT_DECLARED')).length,
    unlimitedRows: esimRows.filter((row) => row.dataLimit === 'Unlimited').length,
    eligibleBeforeProvider: esimRows.filter((row) => row.errors.length === 0).length,
    structuralBlockedRows: structuralBlockedRows.length,
    providerStatusCounts: statusCounts,
    matchedRows: rows.filter((row) => row.providerStatus === 'MATCHED').length,
    blockedRows: rows.filter((row) => (row.providerStatus !== 'MATCHED' && row.providerStatus !== 'SKIPPED_NON_ESIM') || row.errors.length > 0).length,
    leSIMTrue: rows.filter((row) => row.leSIM === true).length,
    leSIMFalse: rows.filter((row) => row.leSIM === false).length,
    sameWmid: sameWmidDiagnostics(esimRows, providersByWmid),
    legacyWmidCollisions,
    legacyWmidCollisionCount: legacyCollisionRows.length,
    rows: rows.slice(0, 20),
    samplesTruncated: rows.length > 20,
  };
};

export { normalizeWmid };
