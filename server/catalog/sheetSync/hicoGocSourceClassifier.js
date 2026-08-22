const normalize = (value) => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');

const TOPUP_LABELS = new Set(['topup', 'top-up', 'top up', 'nạp thêm', 'nap them']);
const ESIM_LABELS = new Set(['esim', 'e sim', 'e-sim']);
const PHYSICAL_LABELS = new Set(['sim', 'sim vật lý', 'sim vat ly', 'physical sim']);

export const normalizeSourceCategoryLabel = normalize;

export const classifySourceCategory = (value) => {
  const label = normalize(value);
  if (TOPUP_LABELS.has(label)) return 'topup';
  if (ESIM_LABELS.has(label)) return 'esim';
  if (PHYSICAL_LABELS.has(label)) return 'physical_sim';
  if (label === 'sim & esim' || label === 'sim va esim' || label === 'sim/e sim' || label === 'sim/esim') return 'sim_and_esim';
  return 'unknown';
};

export const operationEvidenceFor = ({ sourceCategoryLabel, providerOffer, previousOperation } = {}) => {
  if (providerOffer?.providerProductType === 2) return { operation: 'topup', resolution: 'RESOLVED', evidence: 'PROVIDER_PRODUCT_TYPE' };
  if (providerOffer?.providerProductType === 0 || providerOffer?.providerProductType === 1) return { operation: 'new_subscription', resolution: 'RESOLVED', evidence: 'PROVIDER_PRODUCT_TYPE' };
  if (TOPUP_LABELS.has(normalize(sourceCategoryLabel))) return { operation: 'topup', resolution: 'RESOLVED', evidence: 'SOURCE_CATEGORY' };
  if (['esim', 'physical_sim'].includes(classifySourceCategory(sourceCategoryLabel))) return { operation: 'new_subscription', resolution: 'RESOLVED', evidence: 'SOURCE_CATEGORY' };
  if (previousOperation === 'new_subscription' || previousOperation === 'topup' || previousOperation === 'device_sale') {
    return { operation: previousOperation, resolution: 'RESOLVED', evidence: 'PREVIOUS_CANONICAL' };
  }
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
  };
  const normalizedRows = rows.some((row) => Array.isArray(row.branches))
    ? rows
    : [...new Map(rows.map((row) => [row.sourceRow ?? row.sheetRowNumber, { sourceCategoryLabel: row.normalizedData?.sourceCategoryLabel, branches: rows.filter((branch) => (branch.sourceRow ?? branch.sheetRowNumber) === (row.sourceRow ?? row.sheetRowNumber)).map((branch) => ({ ...branch, medium: branch.sourceMedium, status: branch.status, providerOffer: branch.providerOffer })) }])).values()];
  for (const row of normalizedRows) {
    const sourceType = String(row.sourceCategoryLabel ?? '').normalize('NFC').trim() || '<blank>';
    sourceTypeCounts[sourceType] = (sourceTypeCounts[sourceType] ?? 0) + 1;
    const physical = row.branches?.some((branch) => branch.medium === 'physical_sim' && branch.status !== 'INVALID') === true;
    const esim = row.branches?.some((branch) => branch.medium === 'esim' && branch.status !== 'INVALID') === true;
    if (physical) diagnostics.physicalRows += 1;
    if (esim) diagnostics.esimRows += 1;
    if (physical && esim) diagnostics.bothBranches += 1;
    diagnostics.physicalBranches += row.branches?.filter((branch) => branch.medium === 'physical_sim').length ?? 0;
    diagnostics.esimBranches += row.branches?.filter((branch) => branch.medium === 'esim').length ?? 0;
    for (const branch of row.branches ?? []) {
      const providerType = branch.providerOffer?.providerProductType;
      if (providerType !== undefined && providerType !== null) {
        const key = String(providerType);
        diagnostics.providerProductTypeCounts[key] = (diagnostics.providerProductTypeCounts[key] ?? 0) + 1;
      }
    }
  }
  return diagnostics;
};
