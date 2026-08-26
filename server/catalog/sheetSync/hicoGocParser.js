import { SheetSyncError } from './sheetSyncTypes.js';
import {
  DEFAULT_HICO_GOC_FIELD_MAPPING,
  DEFAULT_HICO_GOC_PRICE_MAPPING,
  normalizeHicoGocMapping,
  normalizeHicoGocPriceMapping,
} from './hicoGocMapping.js';
import {
  branchIdentityPresent,
  makeHicoGocBranchCandidate,
} from './hicoGocBranchParser.js';
import { normalizeIdentityToken } from './packageFamilyIdentity.js';
import { sourceOperationFor } from './hicoGocSourceClassifier.js';

export { parseActualDuration, parseActualDurationDescriptor, parseDataLimit, parseDurationValue, parseSpeedLabel } from './hicoGocBranchParser.js';

export const HICO_GOC_PARSER_REVISION = 3;

const branchDefinitions = [
  { medium: 'physical_sim', skuField: 'skuPhysical', wmidField: 'wmproductIdPhysical', priceField: 'physical' },
  { medium: 'esim', skuField: 'skuEsim', wmidField: 'wmproductIdEsim', priceField: 'esim' },
];

export const parseHicoGocRowsWithDiagnostics = (
  values = [],
  { fieldMapping = DEFAULT_HICO_GOC_FIELD_MAPPING, priceMapping = DEFAULT_HICO_GOC_PRICE_MAPPING, headerRow = 1 } = {},
) => {
  if (!Array.isArray(values) || values.length < 1 || !Array.isArray(values[0])) {
    throw new SheetSyncError('HICO GỐC does not contain a header row.', { code: 'SHEET_HEADER_REQUIRED', status: 422 });
  }
  if (!Number.isInteger(headerRow) || headerRow < 1) {
    throw new SheetSyncError('HICO GỐC header row is invalid.', { code: 'SHEET_HEADER_INVALID', status: 422 });
  }
  const mapping = normalizeHicoGocMapping(fieldMapping);
  const prices = normalizeHicoGocPriceMapping(priceMapping);
  const rows = [];
  const rejectionReasons = new Map();
  let rowsRead = 0;
  let rowsParsed = 0;
  let rowsRejected = 0;
  let physicalBranches = 0;
  let esimBranches = 0;
  let bothBranchRows = 0;
  let rowsWithSimWmid = 0;
  let rowsWithEsimWmid = 0;
  let rowsWithBothWmid = 0;
  let rowsWithoutWmid = 0;
  let simMissingSku = 0;
  let esimMissingSku = 0;
  const addReason = (code) => rejectionReasons.set(code, (rejectionReasons.get(code) ?? 0) + 1);

  values.slice(1).forEach((cells, offset) => {
    if (!Array.isArray(cells) || !cells.some((value) => String(value ?? '').trim() !== '')) return;
    rowsRead += 1;
    const rowNumber = headerRow + offset + 1;
    const hasSimWmid = branchIdentityPresent({ cells, mapping, ...branchDefinitions[0] });
    const hasEsimWmid = branchIdentityPresent({ cells, mapping, ...branchDefinitions[1] });
    if (hasSimWmid) rowsWithSimWmid += 1;
    if (hasEsimWmid) rowsWithEsimWmid += 1;
    if (hasSimWmid && hasEsimWmid) rowsWithBothWmid += 1;
    if (!hasSimWmid && !hasEsimWmid) rowsWithoutWmid += 1;
    if (hasSimWmid && String(cells[mapping.skuPhysical] ?? '').trim() === '') simMissingSku += 1;
    if (hasEsimWmid && String(cells[mapping.skuEsim] ?? '').trim() === '') esimMissingSku += 1;
    const presentBranches = branchDefinitions.filter((definition) => branchIdentityPresent({ cells, mapping, ...definition }));
    if (presentBranches.length === 0) {
      rowsRejected += 1;
      addReason('MISSING_WMID');
      return;
    }
    if (presentBranches.length === 2) bothBranchRows += 1;
    for (const definition of presentBranches) {
      const candidate = makeHicoGocBranchCandidate({ cells, rowNumber, mapping, priceMapping: prices, ...definition });
      rows.push(candidate);
      rowsParsed += 1;
      if (definition.medium === 'physical_sim') physicalBranches += 1;
      if (definition.medium === 'esim') esimBranches += 1;
      if (candidate.errors.length > 0) {
        rowsRejected += 1;
        candidate.errors.forEach((error) => addReason(error.code));
      }
    }
  });

  return {
    rows,
    diagnostics: {
      rowsRead,
      rowsParsed,
      rowsRejected,
      sourceRows: rowsRead,
      physicalBranches,
      simBranches: physicalBranches,
      esimBranches,
      bothBranchRows,
      rowsWithSimWmid,
      rowsWithEsimWmid,
      rowsWithBothWmid,
      rowsWithoutWmid,
      simMissingSku,
      esimMissingSku,
      rejectionReasons: Object.fromEntries([...rejectionReasons.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))),
    },
  };
};

export const parseHicoGocRows = (values = [], options = {}) => parseHicoGocRowsWithDiagnostics(values, options).rows;

export const normalizedWmidFor = (value) => normalizeIdentityToken(value);

const normalizedValue = (value) => {
  if (Array.isArray(value)) return value.map(normalizedValue).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizedValue(value[key])]));
  if (typeof value === 'string') return normalizeIdentityToken(value);
  return value ?? null;
};

const sourceDataFor = (row) => row?.normalizedData ?? row ?? {};

export const topupDaysFor = (row) => {
  const data = sourceDataFor(row);
  if (Number.isInteger(data.topupDays) && data.topupDays > 0) return data.topupDays;
  const options = Array.isArray(data.tripDayOptions) ? data.tripDayOptions.filter((value) => Number.isInteger(value) && value > 0) : [];
  // For total packages the mapped Sheet day is the Worldmove top-up day;
  // the duration mentioned in the product name is only presentation data.
  if (data.dataPolicy === 'total' && options.length === 1) return options[0];
  if (data.durationUnit === 'day' && Number.isInteger(data.durationValue) && data.durationValue > 0) return data.durationValue;
  if (Number.isInteger(data.durationDays) && data.durationDays > 0) return data.durationDays;
  return options.length === 1 ? options[0] : null;
};

export const tripDayOptionsFor = (row) => {
  const data = sourceDataFor(row);
  const explicitOptions = Array.isArray(data.tripDayOptions) ? data.tripDayOptions : [];
  // For total packages, the mapped duration column is the trip-day source.
  // A duration mentioned in a product name is presentation text, not a second
  // provider/trip-day option.
  const values = explicitOptions.length > 0
    ? explicitOptions
    : [
      ...(data.durationUnit === 'day' && Number.isInteger(data.durationValue) ? [data.durationValue] : []),
      ...(Number.isInteger(data.durationDays) ? [data.durationDays] : []),
    ];
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))].sort((left, right) => left - right);
};

export const operationalIdentityFor = (row, { operation } = {}) => {
  const data = sourceDataFor(row);
  const medium = data.medium ?? row?.sourceMedium;
  const wmid = normalizedWmidFor(data.wmproductId);
  const sourceOperation = sourceOperationFor({
    sourceCategoryLabel: data.sourceCategoryLabel,
    sourceMedium: medium,
    packageClass: data.packageClass,
  }).operation;
  const resolvedOperation = operation ?? data.operation ?? sourceOperation;
  if (!medium || !wmid || !resolvedOperation) return null;
  return resolvedOperation === 'topup'
    ? `${medium}:${wmid}:topup:day:${topupDaysFor(data) ?? 'unresolved'}`
    : `${medium}:${wmid}:${resolvedOperation}`;
};

// Only fields that can change the customer-facing commercial/fulfillment
// contract participate in a provider ambiguity check. SKU and presentation
// fields deliberately do not have business authority.
export const commercialCriticalPayloadFor = (row, { operation } = {}) => {
  const data = row?.normalizedData ?? row ?? {};
  const medium = data.medium ?? row?.sourceMedium;
  const sourceOperation = sourceOperationFor({
    sourceCategoryLabel: data.sourceCategoryLabel,
    sourceMedium: medium,
    packageClass: data.packageClass,
  }).operation;
  const resolvedOperation = operation ?? data.operation ?? sourceOperation;
  return JSON.stringify(normalizedValue({
    medium,
    operation: resolvedOperation,
    dataPolicy: data.dataPolicy,
    dataLimit: data.dataLimit,
    price: data.price,
    currency: data.currency ?? 'VND',
    apn: data.apn,
    activationPolicy: data.activationPolicy,
    speedLabel: data.speedLabel,
    cancellable: data.cancellable,
    coverage: data.coverage,
    ...(resolvedOperation === 'topup' ? { topupDays: topupDaysFor(data) } : {}),
  }));
};

// Legacy export retained for audit compatibility. It now has the narrow
// commercial semantics above, not the old presentation payload semantics.
export const wmidBusinessPayloadKeyFor = (row) => commercialCriticalPayloadFor(row);

const wmidGroupKeyFor = (row) => `${row.sourceMedium}:${normalizedWmidFor(row.normalizedData?.wmproductId)}`;

const withSourceRows = (row, group) => {
  const sourceRows = group.map((item) => item.sheetRowNumber).filter(Number.isInteger).sort((left, right) => left - right);
  const sourceSkus = [...new Set(group.map((item) => item.normalizedData?.sku).filter(Boolean))];
  const sourceNames = [...new Set(group.map((item) => item.normalizedData?.productName).filter(Boolean))];
  const selectedSku = row.normalizedData?.sku;
  return {
    ...row,
    sourceSku: selectedSku,
    sourceRows,
    ...(sourceSkus.length > 1 ? { sourceSkus } : {}),
    ...(sourceNames.length > 1 ? { sourceNames } : {}),
    normalizedData: {
      ...row.normalizedData,
      ...(selectedSku ? { sku: selectedSku } : { sku: undefined }),
      sourceRows,
      ...(sourceSkus.length > 1 ? { sourceSkus } : {}),
      ...(sourceNames.length > 1 ? { sourceNames } : {}),
    },
  };
};

const canonicalRowFor = (rows) => [...rows].sort((left, right) => (
  (left.sheetRowNumber ?? Number.MAX_SAFE_INTEGER) - (right.sheetRowNumber ?? Number.MAX_SAFE_INTEGER)
  || String(left.id ?? '').localeCompare(String(right.id ?? ''))
))[0];

const sourceOperationForRow = (row) => sourceOperationFor({
  sourceCategoryLabel: row.normalizedData?.sourceCategoryLabel,
  sourceMedium: row.sourceMedium,
  packageClass: row.normalizedData?.packageClass,
});

export const collapseHicoGocRows = (rows = []) => {
  const groups = new Map();
  for (const row of rows) {
    const wmid = normalizedWmidFor(row.normalizedData?.wmproductId);
    if (!wmid) {
      groups.set(`${row.id}:no-wmid`, [row]);
      continue;
    }
    const key = wmidGroupKeyFor(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const collapsed = [];
  for (const group of groups.values()) {
    const identities = new Map();
    for (const row of group) {
      const sourceOperation = sourceOperationForRow(row);
      const key = operationalIdentityFor(row, { operation: sourceOperation.operation })
        ?? `${row.id}:unresolved-operation`;
      identities.set(key, [...(identities.get(key) ?? []), row]);
    }
    for (const identityGroup of identities.values()) {
      const sourceOperation = sourceOperationForRow(identityGroup[0]);
      const payloads = new Set(identityGroup.map((row) => commercialCriticalPayloadFor(row, { operation: sourceOperation.operation })));
      if (payloads.size > 1) {
        collapsed.push(...identityGroup.map((row) => ({
          ...withSourceRows(row, identityGroup),
          needsReview: true,
          operationalAmbiguity: true,
          warnings: [...row.warnings, { code: 'WMID_OPERATIONAL_AMBIGUITY', field: 'wmproductId' }],
        })));
        continue;
      }
      const first = withSourceRows(canonicalRowFor(identityGroup), identityGroup);
      const options = first.sourceMedium === 'esim'
        ? [...new Set(identityGroup.flatMap(tripDayOptionsFor))].sort((left, right) => left - right)
        : [];
      const isEsimTripDayBucket = first.sourceMedium === 'esim' && options.length > 1;
      const normalizedData = {
        ...first.normalizedData,
        ...(isEsimTripDayBucket ? {
          tripDayOptions: options,
          duration: undefined,
          durationValue: undefined,
          durationUnit: undefined,
          durationDays: undefined,
        } : {}),
      };
      const duplicate = {
        ...first,
        ...(identityGroup.length > 1 ? {
          collapsedDuplicateCount: identityGroup.length - 1,
          warnings: [...first.warnings, { code: isEsimTripDayBucket ? 'ESIM_TRIP_DAY_BUCKET_COLLAPSED' : 'DUPLICATE_IDENTICAL_COLLAPSED', field: 'wmproductId' }],
        } : {}),
        ...(isEsimTripDayBucket ? { esimTripDayBucket: true } : {}),
        normalizedData,
      };
      collapsed.push({ ...duplicate, rowHash: JSON.stringify(duplicate.normalizedData) });
    }
  }
  return collapsed;
};
