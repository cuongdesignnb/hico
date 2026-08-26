const normalize = (value) => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');

const TOPUP_LABELS = new Set(['topup', 'top-up', 'top up', 'nạp thêm', 'nap them']);
const ESIM_LABELS = new Set(['esim', 'e sim', 'e-sim']);
const PHYSICAL_LABELS = new Set(['sim', 'sim vật lý', 'sim vat ly', 'physical sim']);
const PACKAGE_CLASS_LABELS = new Map([
  ['sim & esim', 'STANDARD_TRAVEL'],
  ['esim', 'STANDARD_TRAVEL'],
  ['sim', 'STANDARD_TRAVEL'],
  ['sẵn gói', 'PRELOADED'],
  ['san goi', 'PRELOADED'],
  ['sim vn', 'DOMESTIC_VN'],
  ['esim+ gọi', 'VOICE'],
  ['esim + gọi', 'VOICE'],
  ['sim/esim + gọi', 'VOICE'],
  ['sim/esim+ gọi', 'VOICE'],
]);

export const HICO_PACKAGE_CLASSES = Object.freeze(['STANDARD_TRAVEL', 'PRELOADED', 'VOICE', 'DOMESTIC_VN', 'UNKNOWN']);

export const normalizeSourceCategoryLabel = normalize;

export const classifyHicoPackageClass = (value) => PACKAGE_CLASS_LABELS.get(normalize(value)) ?? 'UNKNOWN';
export const packageClassFor = classifyHicoPackageClass;

export const classifySourceCategory = (value) => {
  const label = normalize(value);
  if (TOPUP_LABELS.has(label)) return 'topup';
  if (ESIM_LABELS.has(label)) return 'esim';
  if (PHYSICAL_LABELS.has(label)) return 'physical_sim';
  if (label === 'sim & esim' || label === 'sim va esim' || label === 'sim/e sim' || label === 'sim/esim') return 'sim_and_esim';
  if (label === 'esim+ gọi' || label === 'esim + gọi') return 'esim';
  if (label === 'sim vn') return 'physical_sim';
  if (label === 'sim/esim + gọi' || label === 'sim/esim+ gọi') return 'sim_and_esim';
  return 'unknown';
};

export const operationEvidenceFor = ({ sourceCategoryLabel, sourceMedium, packageClass = classifyHicoPackageClass(sourceCategoryLabel), providerOffer, previousOperation } = {}) => {
  if (providerOffer?.providerProductType === 2) return { operation: 'topup', resolution: 'RESOLVED', evidence: 'PROVIDER_PRODUCT_TYPE' };
  if (providerOffer?.providerProductType === 0 || providerOffer?.providerProductType === 1) return { operation: 'new_subscription', resolution: 'RESOLVED', evidence: 'PROVIDER_PRODUCT_TYPE' };
  // HICO GỐC's physical branch is the existing-SIM top-up branch. A new
  // physical SIM purchase is represented only by an explicit provider type 1
  // offer, handled above.
  if (sourceMedium === 'physical_sim') return { operation: 'topup', resolution: 'RESOLVED', evidence: 'WMID_SIM_BRANCH' };
  if (sourceMedium === 'esim') return { operation: 'new_subscription', resolution: 'RESOLVED', evidence: 'WMID_ESIM_BRANCH' };
  if (TOPUP_LABELS.has(normalize(sourceCategoryLabel))) return { operation: 'topup', resolution: 'RESOLVED', evidence: 'SOURCE_CATEGORY' };
  if (previousOperation === 'new_subscription' || previousOperation === 'topup' || previousOperation === 'device_sale') {
    return { operation: previousOperation, resolution: 'RESOLVED', evidence: 'PREVIOUS_CANONICAL' };
  }
  if (['PRELOADED', 'VOICE', 'DOMESTIC_VN'].includes(packageClass)) return { operation: 'new_subscription', resolution: 'RESOLVED', evidence: 'PACKAGE_CLASS' };
  return { operation: 'new_subscription', resolution: 'UNRESOLVED', evidence: 'NO_EXPLICIT_EVIDENCE' };
};

export const mediumSourceMismatch = (sourceCategoryLabel, medium) => {
  const kind = classifySourceCategory(sourceCategoryLabel);
  return (kind === 'esim' && medium === 'physical_sim') || (kind === 'physical_sim' && medium === 'esim');
};

export const classifyHicoGocSourceRows = (rows = []) => {
  const sourceTypeCounts = {};
  const diagnostics = {
    sourceTypeCounts,
    physicalBranches: 0,
    esimBranches: 0,
    bothBranches: 0,
    physicalRows: 0,
    esimRows: 0,
    providerProductTypeCounts: {},
    packageClassCounts: {},
    branchStatus: {
      physical: { complete: 0, missingSku: 0, missingWmid: 0, invalidPrice: 0, partialIdentity: 0 },
      esim: { complete: 0, missingSku: 0, missingWmid: 0, invalidPrice: 0, partialIdentity: 0 },
    },
    rowsWithoutIdentity: 0,
  };
  const normalizedRows = rows.some((row) => Array.isArray(row.branches))
    ? rows
    : [...new Map(rows.map((row) => [row.sourceRow ?? row.sheetRowNumber, { sourceCategoryLabel: row.normalizedData?.sourceCategoryLabel, branches: rows.filter((branch) => (branch.sourceRow ?? branch.sheetRowNumber) === (row.sourceRow ?? row.sheetRowNumber)).map((branch) => ({ ...branch, medium: branch.sourceMedium, status: branch.status, providerOffer: branch.providerOffer })) }])).values()];
  for (const row of normalizedRows) {
    const sourceType = String(row.sourceCategoryLabel ?? '').normalize('NFC').trim() || '<blank>';
    sourceTypeCounts[sourceType] = (sourceTypeCounts[sourceType] ?? 0) + 1;
    const packageClass = row.packageClass ?? classifyHicoPackageClass(row.sourceCategoryLabel);
    diagnostics.packageClassCounts[packageClass] = (diagnostics.packageClassCounts[packageClass] ?? 0) + 1;
    const physical = row.branches?.some((branch) => branch.medium === 'physical_sim' && branch.status !== 'INVALID') === true;
    const esim = row.branches?.some((branch) => branch.medium === 'esim' && branch.status !== 'INVALID') === true;
    if (physical) diagnostics.physicalRows += 1;
    if (esim) diagnostics.esimRows += 1;
    if (physical && esim) diagnostics.bothBranches += 1;
    if (!physical && !esim) diagnostics.rowsWithoutIdentity += 1;
    diagnostics.physicalBranches += row.branches?.filter((branch) => branch.medium === 'physical_sim').length ?? 0;
    diagnostics.esimBranches += row.branches?.filter((branch) => branch.medium === 'esim').length ?? 0;
    for (const branch of row.branches ?? []) {
      const medium = branch.medium;
      const status = diagnostics.branchStatus[medium];
      if (status) {
        const codes = new Set((branch.errors ?? []).map((error) => error.code));
        if (branch.status !== 'INVALID') status.complete += 1;
        if (codes.has(`MISSING_${medium === 'esim' ? 'ESIM' : 'PHYSICAL'}_SKU`) || codes.has('MISSING_SKU')) status.missingSku += 1;
        if (codes.has(`MISSING_${medium === 'esim' ? 'ESIM' : 'PHYSICAL'}_WMID`) || codes.has('MISSING_WMID')) status.missingWmid += 1;
        if (codes.has('INVALID_SELLING_PRICE')) status.invalidPrice += 1;
        if (codes.has('INVALID_BRANCH_PAIR')) status.partialIdentity += 1;
      }
      const providerType = branch.providerOffer?.providerProductType;
      if (providerType !== undefined && providerType !== null) {
        const key = String(providerType);
        diagnostics.providerProductTypeCounts[key] = (diagnostics.providerProductTypeCounts[key] ?? 0) + 1;
      }
    }
  }
  return diagnostics;
};
