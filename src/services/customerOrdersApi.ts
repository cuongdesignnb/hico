import type { CustomerOrder, CustomerOrdersResponse } from '../types/customerOrder';
import type { CustomerApiError } from './customerDashboardApi';

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    const error = new Error(body?.error ?? 'Customer orders request failed.') as CustomerApiError;
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
};

export const listCustomerOrders = (query: { page?: number; pageSize?: number; status?: string } = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value) params.set(key, String(value)); });
  return request<CustomerOrdersResponse>(`/api/customer/orders?${params.toString()}`);
};
export const getCustomerOrder = (orderId: string) => request<{ order: CustomerOrder }>(`/api/customer/orders/${encodeURIComponent(orderId)}`);
