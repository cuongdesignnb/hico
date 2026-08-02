import type { Customer } from '../types/customer';

interface CustomerPayload {
  customer: Customer;
  csrfToken: string;
}

interface ApiError extends Error {
  code?: string;
  status?: number;
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    const error = new Error(body?.error ?? 'Customer authentication request failed.') as ApiError;
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
};

export const getCurrentCustomer = () => request<CustomerPayload>('/api/customer/me');
export const login = (email: string, password: string) => request<CustomerPayload>('/api/customer/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const register = (input: { email: string; password: string; displayName: string; phone?: string }) => request<{ customer: Customer; verificationRequired: boolean }>('/api/customer/auth/register', { method: 'POST', body: JSON.stringify(input) });
export const logout = (csrfToken: string) => request<void>('/api/customer/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
export const refresh = (csrfToken: string) => request<CustomerPayload>('/api/customer/auth/refresh', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
export const reauth = (password: string, csrfToken: string) => request<{ reauthenticated: boolean }>('/api/customer/auth/reauth', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ password }) });
export const requestPasswordReset = (email: string) => request<{ accepted: boolean }>('/api/customer/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) });
export const resetPassword = (token: string, password: string) => request<void>('/api/customer/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
export const verifyEmail = (token: string) => request<void>('/api/customer/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
