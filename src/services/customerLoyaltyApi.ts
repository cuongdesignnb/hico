import type { LoyaltyRule, LoyaltySummary, LoyaltyTransactionList } from '../types/loyalty';

interface ApiError extends Error { code?: string; status?: number; }

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, { ...init, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    const error = new Error(body?.error ?? 'Điểm thưởng chưa sẵn sàng.') as ApiError;
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
};

export const getLoyaltySummary = (signal?: AbortSignal) => request<LoyaltySummary>('/api/customer/loyalty', { signal });
export const getLoyaltyTransactions = (page: number, pageSize: number, signal?: AbortSignal) => request<LoyaltyTransactionList>(`/api/customer/loyalty/transactions?page=${page}&pageSize=${pageSize}`, { signal });
export const getPublicLoyaltyRules = (signal?: AbortSignal) => request<{ enabled: boolean; items: LoyaltyRule[]; generatedAt: string }>('/api/customer/loyalty/rules/public', { signal });
