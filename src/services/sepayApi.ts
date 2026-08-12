import type { SePaySettings, SePayTransactionList } from '../types/sepay';

const csrf = () => document.cookie.split('; ').find((entry) => entry.startsWith('hico_csrf='))?.split('=').slice(1).join('') ?? '';
const request = async <T>(path: string, init: RequestInit = {}) => {
  const response = await fetch(`/api/admin${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.method && init.method !== 'GET' ? { 'X-CSRF-Token': csrf() } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? 'Không thể xử lý SePay.');
  return payload as T;
};

export const getSePaySettings = () => request<SePaySettings>('/payments/settings');
export const saveSePaySettings = (input: Record<string, unknown>) => request<SePaySettings>('/payments/settings', { method: 'PUT', body: JSON.stringify(input) });
export const replaceSePayCredential = (input: Record<string, unknown>) => request<SePaySettings>('/payments/settings/credential', { method: 'PUT', body: JSON.stringify(input) });
export const getSePayTransactions = () => request<SePayTransactionList>('/payments/transactions');
