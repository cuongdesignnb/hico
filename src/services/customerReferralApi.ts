import type { CustomerReferralOverview } from '../types/referral';

interface ApiError extends Error { code?: string; status?: number; }

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    const error = new Error(body?.error ?? 'Referral unavailable.') as ApiError;
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
};

export const getReferralOverview = (signal?: AbortSignal) => request<CustomerReferralOverview>('/api/customer/referrals', { signal });
export const getReferralHistory = (page = 1, signal?: AbortSignal) => request<CustomerReferralOverview>(`/api/customer/referrals/history?page=${page}`, { signal });
export const applyReferralCode = (code: string, csrfToken: string) => request<{ accepted: boolean; status: string }>('/api/customer/referrals/apply', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ code }) });
