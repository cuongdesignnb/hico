import type { CustomerNotificationList } from '../types/customerNotification';

interface ApiError extends Error { code?: string; status?: number; }

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    const error = new Error(body?.error ?? 'Notifications unavailable.') as ApiError;
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
};

export const getCustomerNotifications = (page = 1, signal?: AbortSignal) => request<CustomerNotificationList>(`/api/customer/notifications?page=${page}`, { signal });
export const getUnreadNotificationCount = (signal?: AbortSignal) => request<{ unreadCount: number }>('/api/customer/notifications/unread-count', { signal });
export const markCustomerNotificationRead = (id: string, csrfToken: string) => request(`/api/customer/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
export const markAllCustomerNotificationsRead = (csrfToken: string) => request('/api/customer/notifications/read-all', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
