import { SheetSyncError } from './sheetSyncTypes.js';

export const FULL_SYNC_SOURCE_EMPTY = 'FULL_SYNC_SOURCE_EMPTY';
export const FULL_SYNC_EMPTY_CANDIDATE = 'FULL_SYNC_EMPTY_CANDIDATE';
export const FULL_SYNC_GROUPING_FAILED = 'FULL_SYNC_GROUPING_FAILED';

const hasCell = (value) => String(value ?? '').trim() !== '';

export const countSourceRows = (values = []) => (
  Array.isArray(values) ? values.slice(1).filter((row) => Array.isArray(row) && row.some(hasCell)).length : 0
);

export const rejectionReasonsForRows = (rows = []) => {
  const reasons = new Map();
  for (const row of rows) for (const error of row.errors ?? []) {
    if (!error?.code) continue;
    reasons.set(error.code, (reasons.get(error.code) ?? 0) + 1);
  }
  return Object.fromEntries([...reasons.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
};

export const topRejectionReasons = (reasons = {}) => Object.entries(reasons)
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .slice(0, 10)
  .map(([code, count]) => ({ code, count }));

export const fullSyncDiagnostics = ({ reference, range, parser, candidate, baselineCatalog } = {}) => {
  const candidateReasons = candidate?.summary?.rejectionReasons ?? rejectionReasonsForRows(candidate?.rows ?? []);
  const previousProducts = baselineCatalog?.products?.length ?? 0;
  const previousVariants = baselineCatalog?.variants?.length ?? 0;
  const candidateProducts = candidate?.summary?.products ?? 0;
  const candidateVariants = candidate?.summary?.variants ?? 0;
  const provider = candidate?.summary?.provider ?? {
    resolved: 0,
    unresolved: 0,
    ambiguous: 0,
    inactive: 0,
    needsReviewVariants: candidateVariants,
  };
  const sizeDropWarning = previousProducts > 0 && previousVariants > 0 && (candidateProducts < previousProducts * 0.5 || candidateVariants < previousVariants * 0.5)
    ? { code: 'CATALOG_SIZE_DROP_WARNING', previousProducts, previousVariants, candidateProducts, candidateVariants }
    : null;
  return {
    source: {
      sheet: reference?.sheetTab ?? null,
      range: reference?.sheetRange ?? null,
      rowsRead: parser?.rowsRead ?? countSourceRows(reference?.values),
      headerColumns: range?.headerColumns ?? reference?.values?.[0]?.length ?? 0,
      requiredLastColumn: range?.requiredLastColumn ?? null,
      configuredLastColumn: range?.configuredLastColumn ?? null,
      batching: reference?.batching ?? null,
    },
    parser: {
      rowsParsed: parser?.rowsParsed ?? 0,
      rowsRejected: parser?.rowsRejected ?? 0,
      rejectionReasons: parser?.rejectionReasons ?? {},
    },
    candidate: {
      products: candidateProducts,
      variants: candidateVariants,
      validRows: candidate?.summary?.validRows ?? 0,
      uniqueProductKeys: candidate?.summary?.uniqueProductKeys ?? 0,
      packageFamilies: candidate?.summary?.packageFamilies ?? 0,
      exactDuplicatesCollapsed: candidate?.summary?.exactDuplicatesCollapsed ?? 0,
      groupingCollisions: candidate?.summary?.groupingCollisions ?? 0,
      operationUnresolved: candidate?.summary?.operationUnresolved ?? 0,
      operations: candidate?.summary?.operations ?? {},
      mediums: candidate?.summary?.mediums ?? {},
      coverageFilters: candidate?.summary?.coverageFilters ?? [],
      sourceClassification: candidate?.summary?.sourceClassification ?? {},
      topRejectionReasons: topRejectionReasons(candidateReasons),
    },
    provider,
    ...(sizeDropWarning ? { sizeDropWarning } : {}),
  };
};

const emptyDetails = (diagnostics) => ({
  rowsRead: diagnostics?.source?.rowsRead ?? 0,
  rowsParsed: diagnostics?.parser?.rowsParsed ?? 0,
  products: diagnostics?.candidate?.products ?? 0,
  variants: diagnostics?.candidate?.variants ?? 0,
  ...(diagnostics ? { diagnostics } : {}),
});

export const assertFullSyncCandidate = (diagnostics) => {
  const rowsRead = diagnostics?.source?.rowsRead ?? 0;
  const products = diagnostics?.candidate?.products ?? 0;
  const variants = diagnostics?.candidate?.variants ?? 0;
  if (rowsRead === 0) throw new SheetSyncError('HICO GỐC không có dữ liệu để đồng bộ. Hãy kiểm tra range và tab trước khi thử lại.', { code: FULL_SYNC_SOURCE_EMPTY, status: 422, details: emptyDetails(diagnostics) });
  if (products === 0 || variants === 0) {
    const groupingFailed = (diagnostics?.candidate?.validRows ?? 0) > 0 && diagnostics?.candidate?.uniqueProductKeys === 0;
    throw new SheetSyncError(
      groupingFailed ? 'Dữ liệu HICO GỐC đã parse nhưng không tạo được product group.' : 'Không thể tạo catalog từ HICO GỐC. Candidate đang rỗng.',
      { code: groupingFailed ? FULL_SYNC_GROUPING_FAILED : FULL_SYNC_EMPTY_CANDIDATE, status: 422, details: emptyDetails(diagnostics) },
    );
  }
  return diagnostics;
};

export const assertPersistedFullSyncSummary = (summary = {}) => {
  if (Number(summary.products ?? 0) <= 0 || Number(summary.variants ?? 0) <= 0) {
    throw new SheetSyncError('Full sync batch không có candidate hợp lệ. Hãy tạo preview mới từ HICO GỐC.', {
      code: FULL_SYNC_EMPTY_CANDIDATE,
      status: 422,
      details: {
        rowsRead: Number(summary.source?.rowsRead ?? summary.total ?? 0),
        rowsParsed: Number(summary.parser?.rowsParsed ?? 0),
        products: Number(summary.products ?? 0),
        variants: Number(summary.variants ?? 0),
      },
    });
  }
};
