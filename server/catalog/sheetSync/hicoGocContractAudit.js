import { branchIdentityPresent } from './hicoGocBranchParser.js';
import { DEFAULT_HICO_GOC_FIELD_MAPPING, normalizeHicoGocMapping } from './hicoGocMapping.js';
import { classifyHicoPackageClass } from './hicoGocSourceClassifier.js';
import { parseHicoCoverage } from '../coverage/hicoCoverageParser.js';

const nonEmpty = (value) => String(value ?? '').trim() !== '';
const safeLabel = (value) => {
  const text = String(value ?? '').normalize('NFC').trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

export const auditHicoGocValues = (values = [], { fieldMapping = DEFAULT_HICO_GOC_FIELD_MAPPING } = {}) => {
  const mapping = normalizeHicoGocMapping(fieldMapping);
  const rows = Array.isArray(values) ? values.slice(1).filter((row) => Array.isArray(row) && row.some(nonEmpty)) : [];
  const sourceTypeCounts = {};
  const dataPolicyCounts = {};
  const networkCounts = {};
  const packageClassCounts = {};
  const destinationCounts = {};
  const diagnostics = {
    rowsRead: rows.length,
    rowsWithPhysicalBranch: 0,
    rowsWithEsimBranch: 0,
    rowsWithBothBranches: 0,
    physicalBranches: 0,
    esimBranches: 0,
    partialPhysicalIdentity: 0,
    partialEsimIdentity: 0,
    rowsWithoutIdentity: 0,
    sourceTypeCounts,
    dataPolicyCounts,
    networkCounts,
    packageClassCounts,
    coverage: {
      resolvedRows: 0,
      needsReviewRows: 0,
      carrierOnlyRows: 0,
      destinationCounts,
    },
    providerNameEvidence: { physical: 0, esim: 0 },
    providerCalculationEvidence: { physical: 0, esim: 0 },
  };
  for (const row of rows) {
    const sourceType = safeLabel(row[mapping.simType]) || '<blank>';
    const dataPolicy = safeLabel(row[mapping.dataType]) || '<blank>';
    const network = safeLabel(row[mapping.networkLabel]) || '<blank>';
    const packageClass = classifyHicoPackageClass(sourceType);
    const coverage = parseHicoCoverage(network === '<blank>' ? '' : network);
    sourceTypeCounts[sourceType] = (sourceTypeCounts[sourceType] ?? 0) + 1;
    dataPolicyCounts[dataPolicy] = (dataPolicyCounts[dataPolicy] ?? 0) + 1;
    networkCounts[network] = (networkCounts[network] ?? 0) + 1;
    packageClassCounts[packageClass] = (packageClassCounts[packageClass] ?? 0) + 1;
    if (coverage.destinations.length > 0) diagnostics.coverage.resolvedRows += 1;
    if (coverage.needsReview) diagnostics.coverage.needsReviewRows += 1;
    if (coverage.carrierOnly) diagnostics.coverage.carrierOnlyRows += 1;
    for (const destination of coverage.destinations) {
      destinationCounts[destination.id] = (destinationCounts[destination.id] ?? 0) + 1;
    }
    const physicalPresent = branchIdentityPresent({ cells: row, mapping, skuField: 'skuPhysical', wmidField: 'wmproductIdPhysical' });
    const esimPresent = branchIdentityPresent({ cells: row, mapping, skuField: 'skuEsim', wmidField: 'wmproductIdEsim' });
    const physicalSku = nonEmpty(row[mapping.skuPhysical]);
    const physicalWmid = nonEmpty(row[mapping.wmproductIdPhysical]);
    const esimSku = nonEmpty(row[mapping.skuEsim]);
    const esimWmid = nonEmpty(row[mapping.wmproductIdEsim]);
    if (physicalPresent) diagnostics.rowsWithPhysicalBranch += 1;
    if (esimPresent) diagnostics.rowsWithEsimBranch += 1;
    if (physicalPresent && esimPresent) diagnostics.rowsWithBothBranches += 1;
    diagnostics.physicalBranches += Number(physicalPresent);
    diagnostics.esimBranches += Number(esimPresent);
    if (physicalSku !== physicalWmid) diagnostics.partialPhysicalIdentity += 1;
    if (esimSku !== esimWmid) diagnostics.partialEsimIdentity += 1;
    if (!physicalPresent && !esimPresent) diagnostics.rowsWithoutIdentity += 1;
    if (nonEmpty(row[20])) diagnostics.providerNameEvidence.physical += 1;
    if (nonEmpty(row[25])) diagnostics.providerNameEvidence.esim += 1;
    if (nonEmpty(row[21])) diagnostics.providerCalculationEvidence.physical += 1;
    if (nonEmpty(row[22])) diagnostics.providerCalculationEvidence.esim += 1;
  }
  return diagnostics;
};
