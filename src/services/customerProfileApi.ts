import type { CustomerAddress, CustomerProfile, CustomerSecurityEventList, CustomerSession } from '../types/customerProfile';
import type { CustomerApiError } from './customerDashboardApi';

const request = async <T>(path: string, csrfToken = '', init: RequestInit = {}): Promise<T> => {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  Object.entries(init.headers ?? {}).forEach(([key, value]) => headers.set(key, String(value)));
  const response = await fetch(path, { ...init, credentials: 'include', cache: 'no-store', headers });
  if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string; code?: string } | null; const error = new Error(body?.error ?? 'Customer profile request failed.') as CustomerApiError; error.code = body?.code; error.status = response.status; throw error; }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
};
export const getCustomerProfile = () => request<{ profile: CustomerProfile }>('/api/customer/profile');
export const updateCustomerProfile = (input: Partial<Pick<CustomerProfile, 'displayName' | 'locale' | 'timezone' | 'avatarUrl'>>, csrf: string) => request<{ profile: CustomerProfile }>('/api/customer/profile', csrf, { method: 'PUT', body: JSON.stringify(input) });
export const requestContactChange = (type: 'email' | 'phone', value: string, csrf: string) => request<{ accepted: boolean }>(`/api/customer/profile/${type}/change/request`, csrf, { method: 'POST', body: JSON.stringify({ value }) });
export const getCustomerAddresses = () => request<{ addresses: CustomerAddress[] }>('/api/customer/addresses');
export const createCustomerAddress = (input: Partial<CustomerAddress>, csrf: string) => request<{ address: CustomerAddress }>('/api/customer/addresses', csrf, { method: 'POST', body: JSON.stringify(input) });
export const updateCustomerAddress = (id: string, input: Partial<CustomerAddress>, csrf: string) => request<{ address: CustomerAddress }>(`/api/customer/addresses/${encodeURIComponent(id)}`, csrf, { method: 'PUT', body: JSON.stringify(input) });
export const setCustomerDefaultAddress = (id: string, csrf: string) => request<{ address: CustomerAddress }>(`/api/customer/addresses/${encodeURIComponent(id)}/default`, csrf, { method: 'POST' });
export const deleteCustomerAddress = (id: string, csrf: string) => request<void>(`/api/customer/addresses/${encodeURIComponent(id)}`, csrf, { method: 'DELETE' });
export const getCustomerSessions = () => request<{ sessions: CustomerSession[] }>('/api/customer/sessions');
export const revokeCustomerSession = (id: string, csrf: string) => request<void>(`/api/customer/sessions/${encodeURIComponent(id)}`, csrf, { method: 'DELETE' });
export const logoutAllCustomerSessions = (csrf: string) => request<void>('/api/customer/sessions/logout-all', csrf, { method: 'POST' });
export const changeCustomerPassword = (currentPassword: string, newPassword: string, csrf: string) => request<{ changed: boolean }>('/api/customer/security/password/change', csrf, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
export const getCustomerSecurityEvents = (page = 1) => request<CustomerSecurityEventList>(`/api/customer/security/events?page=${page}`);
