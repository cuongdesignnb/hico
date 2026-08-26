import { parsePrice } from './sheetRowParser.js';
import { DEFAULT_HICO_GOC_FIELD_MAPPING, DEFAULT_HICO_GOC_PRICE_MAPPING, hicoGocColumnName, normalizeHicoGocMapping, normalizeHicoGocPriceMapping } from './hicoGocMapping.js';
import { classifyHicoPackageClass, mediumSourceMismatch } from './hicoGocSourceClassifier.js';
import { parseHicoCoverage } from '../coverage/hicoCoverageParser.js';
import { parseHicoGocRows, normalizedWmidFor, wmidBusinessPayloadKeyFor } from './hicoGocParser.js';

const nonEmpty = (value) => String(value ?? '').trim() !== '';
const safeLabel = (value) => {
  const text = String(value ?? '').normalize('NFC').trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

const SOURCE_CONTRACT_MEANINGS = Object.freeze({
  simType: 'Source Type / loại SIM gốc', productName: 'Tên gói', durationDays: 'Ngày / trip option', dataType: 'Chính sách data',
  pricePhysical: 'Giá bán SIM vật lý', priceEsim: 'Giá bán eSIM', priceWholesalePhysical: 'Giá sỉ SIM vật lý', priceWholesaleEsim: 'Giá sỉ eSIM',
  priceCtvPhysical: 'Giá CTV SIM vật lý', priceCtvEsim: 'Giá CTV eSIM', apn: 'APN', networkLabel: 'Quốc gia / nhà mạng',
  publicNote: 'Ghi chú public', activationPolicy: 'Mốc reset / kích hoạt', availability: 'Tình trạng cung cấp', cancellable: 'Có thể hủy gói',
  skuPhysical: 'SKU SIM vật lý', skuEsim: 'SKU eSIM', wmproductIdPhysical: 'WMID SIM vật lý', wmproductIdEsim: 'WMID eSIM',
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
