import type { CustomerApiError } from './customerDashboardApi';
import type { CustomerSupportDetail, CustomerSupportList } from '../types/customerSupport';
const request = async <T>(path: string, csrfToken = '', init: RequestInit = {}): Promise<T> => {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' }); if (csrfToken) headers.set('X-CSRF-Token', csrfToken); Object.entries(init.headers ?? {}).forEach(([key, value]) => headers.set(key, String(value)));
  const response = await fetch(path, { ...init, credentials: 'include', cache: 'no-store', headers });
  if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string; code?: string } | null; const error = new Error(body?.error ?? 'Customer support request failed.') as CustomerApiError; error.code = body?.code; error.status = response.status; throw error; }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
};
export const getCustomerTickets = () => request<CustomerSupportList>('/api/customer/tickets');
export const createCustomerTicket = (input: Record<string, unknown>, csrf: string) => request<CustomerSupportDetail>('/api/customer/tickets', csrf, { method: 'POST', body: JSON.stringify(input) });
export const getCustomerTicket = (id: string) => request<CustomerSupportDetail>(`/api/customer/tickets/${encodeURIComponent(id)}`);
export const addCustomerTicketMessage = (id: string, body: string, csrf: string) => request<CustomerSupportDetail>(`/api/customer/tickets/${encodeURIComponent(id)}/messages`, csrf, { method: 'POST', body: JSON.stringify({ body }) });
export const closeCustomerTicket = (id: string, csrf: string) => request(`/api/customer/tickets/${encodeURIComponent(id)}/close`, csrf, { method: 'POST' });
export const uploadCustomerTicketAttachment = (id: string, fileName: string, mimeType: string, contentBase64: string, csrf: string) => request<{ attachment: unknown }>(`/api/customer/tickets/${encodeURIComponent(id)}/attachments`, csrf, { method: 'POST', body: JSON.stringify({ fileName, mimeType, contentBase64 }) });
