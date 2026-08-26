import { parsePrice } from './sheetRowParser.js';
import { DEFAULT_HICO_GOC_FIELD_MAPPING, DEFAULT_HICO_GOC_PRICE_MAPPING, hicoGocColumnName, normalizeHicoGocMapping, normalizeHicoGocPriceMapping } from './hicoGocMapping.js';
import { classifyHicoPackageClass, mediumSourceMismatch, sourceOperationFor } from './hicoGocSourceClassifier.js';
import { parseHicoCoverage } from '../coverage/hicoCoverageParser.js';
import { commercialCriticalPayloadFor, operationalIdentityFor, parseHicoGocRows, normalizedWmidFor, topupDaysFor, tripDayOptionsFor, wmidBusinessPayloadKeyFor } from './hicoGocParser.js';

const nonEmpty = (value) => String(value ?? '').trim() !== '';
const safeLabel = (value) => {
  const text = String(value ?? '').normalize('NFC').trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

const SOURCE_CONTRACT_MEANINGS = Object.freeze({
  simType: 'Source Type / loại SIM gốc', productName: 'Tên gói', durationDays: 'Ngày / trip option', dataType: 'Chính sách data',
  pricePhysical: 'Giá SIM / Top-up', priceEsim: 'Giá bán eSIM', priceWholesalePhysical: 'Giá sỉ SIM / Top-up', priceWholesaleEsim: 'Giá sỉ eSIM',
  priceCtvPhysical: 'Giá CTV SIM vật lý', priceCtvEsim: 'Giá CTV eSIM', apn: 'APN', networkLabel: 'Quốc gia / nhà mạng',
  publicNote: 'Ghi chú public', activationPolicy: 'Mốc reset / kích hoạt', availability: 'Tình trạng cung cấp', cancellable: 'Có thể hủy gói',
  skuPhysical: 'SKU SIM (metadata only)', skuEsim: 'SKU eSIM (metadata only)', wmproductIdPhysical: 'WMID SIM / Top-up', wmproductIdEsim: 'WMID eSIM',
});

export const hicoGocSourceContract = (headers = [], fieldMapping = DEFAULT_HICO_GOC_FIELD_MAPPING) => {
  const mapping = normalizeHicoGocMapping(fieldMapping);
  const fieldsByColumn = new Map(Object.entries(mapping).map(([field, column]) => [column, field]));
  const lastColumn = Math.max(Math.max(0, headers.length - 1), ...Object.values(mapping).filter((value) => value !== null && value !== undefined));
  return Array.from({ length: lastColumn + 1 }, (_, column) => {
    const field = fieldsByColumn.get(column) ?? null;
    return {
      column: hicoGocColumnName(column),
      rawHeader: normalizeSourceType(headers[column]),
      normalizedBusinessMeaning: field ? SOURCE_CONTRACT_MEANINGS[field] ?? field : 'Không thuộc contract mapping hiện tại',
      currentCodeMapping: field,
      match: field ? 'MATCH' : 'UNMAPPED',
    };
  });
};

const branchAuditFor = ({ row, mapping, priceMapping, medium }) => {
  const suffix = medium === 'physical_sim' ? 'Physical' : 'Esim';
  const skuPresent = nonEmpty(row[mapping[`sku${suffix}`]]);
  const wmidPresent = nonEmpty(row[mapping[`wmproductId${suffix}`]]);
  const rawPrice = row[mapping[priceMapping[medium === 'physical_sim' ? 'physical' : 'esim']]];
  const pricePresent = nonEmpty(rawPrice);
  const priceIssues = [];
  const parsedPrice = parsePrice(rawPrice, priceIssues, 'price');
  const hasData = skuPresent || wmidPresent || pricePresent;
  return {
    hasData,
    identityPresent: wmidPresent,
    complete: hasData && wmidPresent && parsedPrice !== undefined,
    missingSku: hasData && !skuPresent,
    missingWmid: hasData && !wmidPresent,
    missingPrice: hasData && !pricePresent,
    invalidPrice: pricePresent && parsedPrice === undefined,
    partialIdentity: hasData && !wmidPresent,
  };
};

const addBranchAudit = (target, branch) => {
  if (branch.hasData) target.rowsWithData += 1;
  if (branch.identityPresent) target.identityPresent += 1;
  if (branch.complete) target.complete += 1;
  if (branch.missingSku) target.missingSku += 1;
  if (branch.missingWmid) target.missingWmid += 1;
  if (branch.missingPrice) target.missingPrice += 1;
  if (branch.invalidPrice) target.invalidPrice += 1;
  if (branch.partialIdentity) target.partialIdentity += 1;
};

const normalizedAuditKey = (value) => JSON.stringify(value ?? null);
const durationAuditValue = (data = {}) => ({
  duration: data.duration ?? null,
  durationValue: data.durationValue ?? null,
  durationUnit: data.durationUnit ?? null,
  tripDayOptions: Array.isArray(data.tripDayOptions) ? [...data.tripDayOptions].sort((left, right) => left - right) : [],
});
const dataAuditValue = (data = {}) => ({ dataPolicy: data.dataPolicy ?? null, dataLimit: data.dataLimit ?? null });
const coverageAuditValue = (data = {}) => (Array.isArray(data.coverage?.destinations)
  ? data.coverage.destinations.map((destination) => destination.id ?? destination.name).sort()
  : []);

const auditSampleFor = (group) => {
  const first = group[0];
  return {
    medium: first.sourceMedium,
    normalizedWmid: normalizedWmidFor(first.normalizedData?.wmproductId),
    sheetRowNumbers: group.map((row) => row.sheetRowNumber).filter(Number.isInteger).sort((left, right) => left - right),
    records: group.map((row) => {
      const data = row.normalizedData ?? {};
      return {
        productName: safeLabel(data.productName) || null,
        duration: safeLabel(data.duration) || null,
        dataLimit: safeLabel(data.dataLimit) || null,
        dataPolicy: safeLabel(data.dataPolicy) || null,
        sellingPrice: Number.isFinite(data.price) ? data.price : null,
        coverage: coverageAuditValue(data),
        sku: safeLabel(data.sku) || null,
      };
    }),
  };
};

const wmidDifferenceAudit = (wmidGroups) => {
  const groups = [...wmidGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([leftKey, leftGroup], [rightKey, rightGroup]) => leftKey.localeCompare(rightKey)
      || (leftGroup[0].sheetRowNumber ?? 0) - (rightGroup[0].sheetRowNumber ?? 0));
  const metrics = {
    uniqueSimWmid: new Set([...wmidGroups.keys()].filter((key) => key.startsWith('physical_sim:'))).size,
    uniqueEsimWmid: new Set([...wmidGroups.keys()].filter((key) => key.startsWith('esim:'))).size,
    sameWmidSamePayload: 0,
    sameWmidDifferentDuration: 0,
    sameWmidDifferentPrice: 0,
    sameWmidDifferentData: 0,
    sameWmidDifferentCoverage: 0,
    sameWmidOnlySkuDifferent: 0,
  };
  const samples = {
    sameWmidDifferentDuration: [],
    sameWmidDifferentPrice: [],
    sameWmidDifferentData: [],
    sameWmidDifferentCoverage: [],
    sameWmidOnlySkuDifferent: [],
  };
  let sampleCount = 0;
  const addSample = (bucket, group) => {
    if (sampleCount >= 20 || samples[bucket].length >= 20) return;
    samples[bucket].push(auditSampleFor(group));
    sampleCount += 1;
  };
  for (const [, group] of groups) {
    const samePayload = new Set(group.map(wmidBusinessPayloadKeyFor)).size === 1;
    const differentDuration = new Set(group.map((row) => normalizedAuditKey(durationAuditValue(row.normalizedData)))).size > 1;
    const differentPrice = new Set(group.map((row) => normalizedAuditKey(row.normalizedData?.price))).size > 1;
    const differentData = new Set(group.map((row) => normalizedAuditKey(dataAuditValue(row.normalizedData)))).size > 1;
    const differentCoverage = new Set(group.map((row) => normalizedAuditKey(coverageAuditValue(row.normalizedData)))).size > 1;
    const onlySkuDifferent = samePayload && new Set(group.map((row) => normalizedAuditKey(row.normalizedData?.sku))).size > 1;
    if (samePayload) metrics.sameWmidSamePayload += 1;
    if (differentDuration) { metrics.sameWmidDifferentDuration += 1; addSample('sameWmidDifferentDuration', group); }
    if (differentPrice) { metrics.sameWmidDifferentPrice += 1; addSample('sameWmidDifferentPrice', group); }
    if (differentData) { metrics.sameWmidDifferentData += 1; addSample('sameWmidDifferentData', group); }
    if (differentCoverage) { metrics.sameWmidDifferentCoverage += 1; addSample('sameWmidDifferentCoverage', group); }
    if (onlySkuDifferent) { metrics.sameWmidOnlySkuDifferent += 1; addSample('sameWmidOnlySkuDifferent', group); }
  }
  return { metrics, samples };
};

const operationalIdentityAudit = (parsedBranches) => {
  const operationCounts = {};
  const operationResolutionCounts = {};
  const operationalGroups = new Map();
  const providerBucketGroups = new Map();
  for (const branch of parsedBranches) {
    const data = branch.normalizedData ?? {};
    const sourceOperation = sourceOperationFor({
      sourceCategoryLabel: data.sourceCategoryLabel,
      sourceMedium: branch.sourceMedium,
      packageClass: data.packageClass,
    });
    operationCounts[sourceOperation.operation] = (operationCounts[sourceOperation.operation] ?? 0) + 1;
    operationResolutionCounts[sourceOperation.resolution] = (operationResolutionCounts[sourceOperation.resolution] ?? 0) + 1;
    const operationalKey = operationalIdentityFor(branch, { operation: sourceOperation.operation });
    if (operationalKey) operationalGroups.set(operationalKey, [...(operationalGroups.get(operationalKey) ?? []), branch]);
    const wmid = normalizedWmidFor(data.wmproductId);
    if (wmid) {
      const bucketKey = `${branch.sourceMedium}:${wmid}:${sourceOperation.operation}`;
      providerBucketGroups.set(bucketKey, [...(providerBucketGroups.get(bucketKey) ?? []), branch]);
    }
  }
  const operationalAmbiguities = [...operationalGroups.values()].filter((group) => (
    new Set(group.map((row) => commercialCriticalPayloadFor(row, {
      operation: sourceOperationFor({
        sourceCategoryLabel: row.normalizedData?.sourceCategoryLabel,
        sourceMedium: row.sourceMedium,
        packageClass: row.normalizedData?.packageClass,
      }).operation,
    }))).size > 1
  ));
  const durationBucketGroups = [...providerBucketGroups.values()].filter((group) => {
    if (group[0]?.sourceMedium !== 'esim' || group[0]?.normalizedData?.packageClass === undefined) return false;
    const options = new Set(group.flatMap(tripDayOptionsFor));
    const payloads = new Set(group.map((row) => commercialCriticalPayloadFor(row, { operation: 'new_subscription' })));
    return options.size > 1 && payloads.size === 1;
  });
  const topupMultiDayWmidGroups = [...providerBucketGroups.values()].filter((group) => {
    if (group[0]?.sourceMedium !== 'physical_sim') return false;
    return new Set(group.map(topupDaysFor).filter((value) => Number.isInteger(value) && value > 0)).size > 1;
  });
  return {
    sourceOperationCounts: operationCounts,
    sourceOperationResolutionCounts: operationResolutionCounts,
    operationalWmidAmbiguities: operationalAmbiguities.length,
    durationBucketGroups: durationBucketGroups.length,
    topupMultiDayWmidGroups: topupMultiDayWmidGroups.length,
    exactWmidDuplicatesCollapsed: [...operationalGroups.values()].reduce((total, group) => {
      const duplicateCount = group.length - 1;
      const payloads = new Set(group.map((row) => commercialCriticalPayloadFor(row, { operation: sourceOperationFor({
        sourceCategoryLabel: row.normalizedData?.sourceCategoryLabel,
        sourceMedium: row.sourceMedium,
        packageClass: row.normalizedData?.packageClass,
      }).operation })));
      return total + (payloads.size === 1 ? duplicateCount : 0);
    }, 0),
  };
};

export const auditHicoGocValues = (
  values = [],
  { fieldMapping = DEFAULT_HICO_GOC_FIELD_MAPPING, priceMapping = DEFAULT_HICO_GOC_PRICE_MAPPING } = {},
) => {
  const mapping = normalizeHicoGocMapping(fieldMapping);
  const prices = normalizeHicoGocPriceMapping(priceMapping);
  const rows = Array.isArray(values) ? values.slice(1).filter((row) => Array.isArray(row) && row.some(nonEmpty)) : [];
  const sourceContract = hicoGocSourceContract(Array.isArray(values?.[0]) ? values[0] : [], mapping);
  const sourceTypeCounts = {};
  const dataPolicyCounts = {};
  const networkCounts = {};
  const packageClassCounts = {};
  const destinationCounts = {};
  const destinationNames = {};
  const sourceTypeDiagnostics = {};
  const parsedBranches = Array.isArray(values) && Array.isArray(values[0])
    ? parseHicoGocRows(values, { fieldMapping: mapping, priceMapping: prices })
    : [];
  const wmidGroups = new Map();
  for (const branch of parsedBranches) {
    const key = `${branch.sourceMedium}:${normalizedWmidFor(branch.normalizedData?.wmproductId)}`;
    if (!key.endsWith(':')) wmidGroups.set(key, [...(wmidGroups.get(key) ?? []), branch]);
  }
  const duplicateGroups = [...wmidGroups.values()].filter((group) => group.length > 1);
  const conflictGroups = duplicateGroups.filter((group) => new Set(group.map(wmidBusinessPayloadKeyFor)).size > 1);
  const wmidAudit = wmidDifferenceAudit(wmidGroups);
  const operationAudit = operationalIdentityAudit(parsedBranches);
  const branchDiagnostics = {
    physical: { rowsWithData: 0, identityPresent: 0, complete: 0, missingSku: 0, missingWmid: 0, missingPrice: 0, invalidPrice: 0, partialIdentity: 0 },
    esim: { rowsWithData: 0, identityPresent: 0, complete: 0, missingSku: 0, missingWmid: 0, missingPrice: 0, invalidPrice: 0, partialIdentity: 0 },
  };
  const diagnostics = {
    rowsRead: rows.length,
    sourceRows: rows.length,
    sourceContract,
    rowsWithPhysicalBranch: 0,
    rowsWithEsimBranch: 0,
    rowsWithBothBranches: 0,
    physicalBranches: 0,
    esimBranches: 0,
    physicalIdentityComplete: 0,
    esimIdentityComplete: 0,
    bothIdentityComplete: 0,
    partialPhysicalIdentity: 0,
    partialEsimIdentity: 0,
    rowsWithoutIdentity: 0,
    rowsWithSimWmid: 0,
    rowsWithEsimWmid: 0,
    rowsWithBothWmid: 0,
    rowsWithoutWmid: 0,
    simBranches: 0,
    esimBranches: 0,
    simMissingSku: 0,
    esimMissingSku: 0,
    duplicateSimWmid: duplicateGroups.filter((group) => group[0].sourceMedium === 'physical_sim').length,
    duplicateEsimWmid: duplicateGroups.filter((group) => group[0].sourceMedium === 'esim').length,
    wmidConflicts: conflictGroups.length,
    wmidConflictSemantics: 'commercial-critical payload differences; not automatic invalidation',
    ...wmidAudit.metrics,
    wmidDifferenceSamples: wmidAudit.samples,
    ...operationAudit,
    branchDiagnostics,
    sourceTypeCounts,
    sourceTypeDiagnostics,
    dataPolicyCounts,
    networkCounts,
    packageClassCounts,
    coverage: {
      resolvedRows: 0,
      needsReviewRows: 0,
      missingRows: 0,
      unresolvedRows: 0,
      carrierOnlyRows: 0,
      destinationCounts,
      destinationNames,
    },
    providerNameEvidence: { physical: 0, esim: 0 },
    providerCalculationEvidence: { physical: 0, esim: 0 },
  };
  for (const row of rows) {
    const sourceType = normalizeSourceType(safeLabel(row[mapping.simType])) || '<blank>';
    const dataPolicy = safeLabel(row[mapping.dataType]) || '<blank>';
    const network = safeLabel(row[mapping.networkLabel]) || '<blank>';
    const packageClass = classifyHicoPackageClass(sourceType);
    const coverage = parseHicoCoverage(network === '<blank>' ? '' : network);
    const sourceTypeKey = sourceType === '<blank>' ? '' : sourceType;
    const sourceDiagnostic = sourceTypeDiagnostics[sourceType] ??= {
      rawValue: sourceType,
      normalizedValue: sourceTypeKey,
      rowCount: 0,
      physicalIdentityCount: 0,
      esimIdentityCount: 0,
      bothIdentityCount: 0,
      noIdentityCount: 0,
      partialPhysicalIdentityCount: 0,
      partialEsimIdentityCount: 0,
      physicalCompleteCount: 0,
      esimCompleteCount: 0,
      sourceMediumConflictCount: 0,
      packageClass,
    };
    sourceDiagnostic.rowCount += 1;
    sourceTypeCounts[sourceType] = (sourceTypeCounts[sourceType] ?? 0) + 1;
    dataPolicyCounts[dataPolicy] = (dataPolicyCounts[dataPolicy] ?? 0) + 1;
    networkCounts[network] = (networkCounts[network] ?? 0) + 1;
    packageClassCounts[packageClass] = (packageClassCounts[packageClass] ?? 0) + 1;
    if (coverage.destinations.length > 0 && coverage.status === 'RESOLVED') diagnostics.coverage.resolvedRows += 1;
    if (coverage.needsReview) diagnostics.coverage.needsReviewRows += 1;
    if (coverage.status === 'MISSING') diagnostics.coverage.missingRows += 1;
    if (coverage.status === 'UNKNOWN_DESTINATION' || coverage.status === 'UNRESOLVED') diagnostics.coverage.unresolvedRows += 1;
    if (coverage.carrierOnly) diagnostics.coverage.carrierOnlyRows += 1;
    for (const destination of coverage.destinations) {
      destinationCounts[destination.id] = (destinationCounts[destination.id] ?? 0) + 1;
      destinationNames[destination.id] = destination.name;
    }
    const physicalSku = nonEmpty(row[mapping.skuPhysical]);
    const physicalWmid = nonEmpty(row[mapping.wmproductIdPhysical]);
    const esimSku = nonEmpty(row[mapping.skuEsim]);
    const esimWmid = nonEmpty(row[mapping.wmproductIdEsim]);
    const physicalPresent = physicalWmid;
    const esimPresent = esimWmid;
    const physicalComplete = physicalWmid && parsePrice(row[mapping[prices.physical]], [], 'price') !== undefined;
    const esimComplete = esimWmid && parsePrice(row[mapping[prices.esim]], [], 'price') !== undefined;
    sourceDiagnostic.physicalIdentityCount += Number(physicalPresent);
    sourceDiagnostic.esimIdentityCount += Number(esimPresent);
    sourceDiagnostic.bothIdentityCount += Number(physicalComplete && esimComplete);
    sourceDiagnostic.noIdentityCount += Number(!physicalPresent && !esimPresent);
    sourceDiagnostic.partialPhysicalIdentityCount += Number(!physicalWmid && (physicalSku || nonEmpty(row[mapping[prices.physical]])));
    sourceDiagnostic.partialEsimIdentityCount += Number(!esimWmid && (esimSku || nonEmpty(row[mapping[prices.esim]])));
    sourceDiagnostic.physicalCompleteCount += Number(physicalComplete);
    sourceDiagnostic.esimCompleteCount += Number(esimComplete);
    sourceDiagnostic.sourceMediumConflictCount += Number(
      (mediumSourceMismatch(sourceType, 'physical_sim') && physicalPresent)
      || (mediumSourceMismatch(sourceType, 'esim') && esimPresent),
    );
    if (physicalPresent) diagnostics.rowsWithPhysicalBranch += 1;
    if (esimPresent) diagnostics.rowsWithEsimBranch += 1;
    if (physicalPresent && esimPresent) diagnostics.rowsWithBothBranches += 1;
    diagnostics.physicalBranches += Number(physicalPresent);
    diagnostics.esimBranches += Number(esimPresent);
    diagnostics.physicalIdentityComplete += Number(physicalComplete);
    diagnostics.esimIdentityComplete += Number(esimComplete);
    diagnostics.bothIdentityComplete += Number(physicalComplete && esimComplete);
    if (!physicalWmid && (physicalSku || nonEmpty(row[mapping[prices.physical]]))) diagnostics.partialPhysicalIdentity += 1;
    if (!esimWmid && (esimSku || nonEmpty(row[mapping[prices.esim]]))) diagnostics.partialEsimIdentity += 1;
    if (!physicalPresent && !esimPresent) diagnostics.rowsWithoutIdentity += 1;
    if (physicalPresent) diagnostics.rowsWithSimWmid += 1;
    if (esimPresent) diagnostics.rowsWithEsimWmid += 1;
    if (physicalPresent && esimPresent) diagnostics.rowsWithBothWmid += 1;
    if (!physicalPresent && !esimPresent) diagnostics.rowsWithoutWmid += 1;
    if (physicalPresent) diagnostics.simBranches += 1;
    if (physicalPresent && !physicalSku) diagnostics.simMissingSku += 1;
    if (esimPresent && !esimSku) diagnostics.esimMissingSku += 1;
    addBranchAudit(branchDiagnostics.physical, branchAuditFor({ row, mapping, priceMapping: prices, medium: 'physical_sim' }));
    addBranchAudit(branchDiagnostics.esim, branchAuditFor({ row, mapping, priceMapping: prices, medium: 'esim' }));
    if (nonEmpty(row[20])) diagnostics.providerNameEvidence.physical += 1;
    if (nonEmpty(row[25])) diagnostics.providerNameEvidence.esim += 1;
    if (nonEmpty(row[21])) diagnostics.providerCalculationEvidence.physical += 1;
    if (nonEmpty(row[22])) diagnostics.providerCalculationEvidence.esim += 1;
  }
  return diagnostics;
};

const normalizeSourceType = (value) => String(value ?? '').normalize('NFC').trim();
