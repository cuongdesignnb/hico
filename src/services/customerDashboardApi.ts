import type { CustomerDashboardSummary } from '../types/customerDashboard';

export interface CustomerApiError extends Error { code?: string; status?: number }

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    const error = new Error(body?.error ?? 'Customer dashboard request failed.') as CustomerApiError;
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
};

export const getDashboardSummary = () => request<CustomerDashboardSummary>('/api/customer/dashboard/summary');
