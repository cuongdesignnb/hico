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

export { parseActualDuration, parseDataLimit, parseSpeedLabel } from './hicoGocBranchParser.js';

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
  const addReason = (code) => rejectionReasons.set(code, (rejectionReasons.get(code) ?? 0) + 1);

  values.slice(1).forEach((cells, offset) => {
    if (!Array.isArray(cells) || !cells.some((value) => String(value ?? '').trim() !== '')) return;
    rowsRead += 1;
    const rowNumber = headerRow + offset + 1;
    const presentBranches = branchDefinitions.filter((definition) => branchIdentityPresent({ cells, mapping, ...definition }));
    if (presentBranches.length === 0) {
      rowsRejected += 1;
      addReason('MISSING_SKU');
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
      ...(physicalBranches || esimBranches || bothBranchRows ? { physicalBranches, esimBranches, bothBranchRows } : {}),
      rejectionReasons: Object.fromEntries([...rejectionReasons.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))),
    },
  };
};

export const parseHicoGocRows = (values = [], options = {}) => parseHicoGocRowsWithDiagnostics(values, options).rows;

const logicalKey = (row) => {
  const data = row.normalizedData;
  return JSON.stringify([
    data.sku,
    data.medium,
    data.productName,
    data.sourceCategoryLabel,
    data.dataPolicy,
    data.dataLimit,
    data.duration,
    data.coverageLabel,
  ]);
};

const payloadKey = (row) => JSON.stringify([
  row.normalizedData.sku,
  row.normalizedData.medium,
  row.normalizedData.price,
  row.normalizedData.compareAtPrice ?? null,
  row.normalizedData.wmproductId,
  row.normalizedData.apn ?? null,
  row.normalizedData.networkLabel ?? null,
  row.normalizedData.activationPolicy ?? null,
  row.normalizedData.speedLabel ?? null,
  row.normalizedData.cancellable ?? null,
  row.normalizedData.coverageLabel ?? null,
]);

export const collapseHicoGocRows = (rows = []) => {
  const groups = new Map();
  for (const row of rows) {
    if (row.normalizedData.dataPolicy !== 'total') {
      groups.set(`${row.id}:daily`, [row]);
      continue;
    }
    const key = logicalKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const collapsed = [];
  for (const group of groups.values()) {
    if (group.length === 1 || group[0].normalizedData.dataPolicy !== 'total') {
      collapsed.push(...group);
      continue;
    }
    const payloads = new Set(group.map(payloadKey));
    if (payloads.size > 1) {
      collapsed.push(...group.map((row) => ({ ...row, status: 'INVALID', errors: [...row.errors, { code: 'DUPLICATE_CONFLICT' }] })));
      continue;
    }
    const first = group[0];
    const options = [...new Set(group.flatMap((row) => row.normalizedData.tripDayOptions ?? []))].sort((a, b) => a - b);
    collapsed.push({
      ...first,
      normalizedData: { ...first.normalizedData, tripDayOptions: options, sourceRows: group.map((row) => row.sheetRowNumber) },
      sourceRows: group.map((row) => row.sheetRowNumber),
      rowHash: JSON.stringify({ ...first.normalizedData, tripDayOptions: options }),
    });
  }
  return collapsed;
};
