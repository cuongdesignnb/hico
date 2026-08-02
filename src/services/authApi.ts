import type { AuthUser } from '../auth/authTypes';

interface AuthPayload { user: AuthUser; csrfToken: string; }

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    throw Object.assign(new Error(body?.error || 'Authentication request failed.'), { code: body?.code, status: response.status });
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
};

export const getCurrentAuth = () => request<AuthPayload>('/api/auth/me');
export const login = (email: string, password: string) => request<AuthPayload>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const logout = (csrfToken: string) => request<void>('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
export const refresh = (csrfToken: string) => request<AuthPayload>('/api/auth/refresh', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
