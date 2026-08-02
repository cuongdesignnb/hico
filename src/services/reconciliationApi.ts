import type {
  ReconciliationFiltersState,
  ReconciliationListResponse,
  ReconciliationRecord,
  ReconciliationRunResult,
  ReconciliationSummary,
  ReconciliationUpdateRequest,
} from '../types/reconciliation';

const getErrorMessage = (payload: unknown) => {
  if (
    typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  return 'Không thể xử lý hàng đợi reconciliation.';
};

const requestJson = async <T>(
  url: string,
  init?: RequestInit,
): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error('Không thể kết nối dịch vụ reconciliation.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Dịch vụ reconciliation trả về dữ liệu không hợp lệ.');
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as T;
};

export const runReconciliation = () => (
  requestJson<ReconciliationRunResult>(
    '/api/admin/catalog/reconciliation/run',
    { method: 'POST' },
  )
);

export const getReconciliationSummary = (signal?: AbortSignal) => (
  requestJson<ReconciliationSummary>(
    '/api/admin/catalog/reconciliation/summary',
    { signal },
  )
);

export const getReconciliationItems = ({
  filters,
  page,
  pageSize,
  signal,
}: {
  filters: ReconciliationFiltersState;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}) => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.providerProductType !== undefined) {
    params.set('providerProductType', String(filters.providerProductType));
  }
  if (filters.leSIM !== undefined) {
    params.set('leSIM', String(filters.leSIM));
  }

  return requestJson<ReconciliationListResponse>(
    `/api/admin/catalog/reconciliation/items?${params.toString()}`,
    { signal },
  );
};

export const updateReconciliationItem = (
  variantId: string,
  request: ReconciliationUpdateRequest,
) => (
  requestJson<ReconciliationRecord>(
    `/api/admin/catalog/reconciliation/items/${encodeURIComponent(variantId)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    },
  )
);
