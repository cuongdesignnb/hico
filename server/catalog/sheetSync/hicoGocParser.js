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

export { parseActualDuration, parseActualDurationDescriptor, parseDataLimit, parseDurationValue, parseSpeedLabel } from './hicoGocBranchParser.js';

export const HICO_GOC_PARSER_REVISION = 2;

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

const wmidPayloadKeyFor = (row, { includeDuration = true } = {}) => {
  const data = row?.normalizedData ?? row ?? {};
  return JSON.stringify(normalizedValue({
    medium: data.medium,
    productName: data.productName,
    sourceCategoryLabel: data.sourceCategoryLabel,
    packageClass: data.packageClass,
    dataPolicy: data.dataPolicy,
    dataLimit: data.dataLimit,
    ...(includeDuration ? {
      duration: data.duration,
      durationValue: data.durationValue,
      durationUnit: data.durationUnit,
    } : {}),
    price: data.price,
    compareAtPrice: data.compareAtPrice,
    apn: data.apn,
    networkLabel: data.networkLabel,
    activationPolicy: data.activationPolicy,
    speedLabel: data.speedLabel,
    cancellable: data.cancellable,
    coverageLabel: data.coverageLabel,
    coverage: data.coverage,
    publicNote: data.publicNote,
    imageUrl: data.imageUrl,
    galleryImageUrls: data.galleryImageUrls,
    description: data.description,
    installationGuide: data.installationGuide,
  }));
};

export const wmidBusinessPayloadKeyFor = (row) => wmidPayloadKeyFor(row);

// A Worldmove top-up WMID can legitimately serve several day options. This
// relaxed key is used only to distinguish that case from a real business
// conflict; price, data, coverage, and other commercial fields remain part of
// the comparison.
const wmidSharedTopupPayloadKeyFor = (row) => wmidPayloadKeyFor(row, { includeDuration: false });

const wmidGroupKeyFor = (row) => `${row.sourceMedium}:${normalizedWmidFor(row.normalizedData?.wmproductId)}`;

const withSourceRows = (row, group) => {
  const sourceRows = group.map((item) => item.sheetRowNumber).filter(Number.isInteger);
  const sourceSkus = [...new Set(group.map((item) => item.normalizedData?.sku).filter(Boolean))];
  const selectedSku = row.normalizedData?.sku ?? sourceSkus[0];
  return {
    ...row,
    sourceSku: selectedSku,
    sourceRows,
    ...(sourceSkus.length > 1 ? { sourceSkus } : {}),
    normalizedData: {
      ...row.normalizedData,
      ...(selectedSku ? { sku: selectedSku } : { sku: undefined }),
      sourceRows,
      ...(sourceSkus.length > 1 ? { sourceSkus } : {}),
    },
  };
};

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
    if (group.length === 1) {
      collapsed.push(...group);
      continue;
    }
    const payloads = new Set(group.map(wmidBusinessPayloadKeyFor));
    if (group[0].sourceMedium === 'physical_sim'
      && payloads.size > 1
      && new Set(group.map(wmidSharedTopupPayloadKeyFor)).size === 1) {
      collapsed.push(...group.map((row) => ({
        ...withSourceRows(row, group),
        warnings: [...row.warnings, { code: 'WMID_SHARED_TOPUP_DURATION', field: 'duration' }],
      })));
      continue;
    }
    if (payloads.size > 1) {
      collapsed.push(...group.map((row) => ({
        ...withSourceRows(row, group),
        status: 'INVALID',
        needsReview: true,
        wmidConflict: true,
        errors: [...row.errors, { code: 'WMID_CONFLICT', field: 'wmproductId' }],
      })));
      continue;
    }
    const first = withSourceRows(group.find((row) => row.normalizedData?.sku) ?? group[0], group);
    const options = [...new Set(group.flatMap((row) => (
      row.normalizedData.tripDayOptions
      ?? (row.normalizedData.durationUnit === 'day' && Number.isInteger(row.normalizedData.durationValue)
        ? [row.normalizedData.durationValue]
        : [])
    )))].sort((a, b) => a - b);
    const duplicate = {
      ...first,
      ...(group.length > 1 ? {
        collapsedDuplicateCount: group.length - 1,
        warnings: [...first.warnings, { code: 'DUPLICATE_IDENTICAL_COLLAPSED', field: 'wmproductId' }],
      } : {}),
      normalizedData: {
        ...first.normalizedData,
        ...(options.length ? { tripDayOptions: options } : {}),
      },
    };
    collapsed.push({ ...duplicate, rowHash: JSON.stringify(duplicate.normalizedData) });
  }
  return collapsed;
};
