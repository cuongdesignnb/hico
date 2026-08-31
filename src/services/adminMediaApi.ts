import type { MediaAsset } from '../types/media';

const readError = async (response: Response) => {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(payload?.error || 'Không thể xử lý Media Library.');
};

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, credentials: 'include' });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<T>;
};

export const listAdminMedia = (query: { search?: string; mimeType?: string } = {}) => {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.mimeType) params.set('mimeType', query.mimeType);
  return request<MediaAsset[]>(`/api/admin/media${params.toString() ? `?${params}` : ''}`);
};

export const uploadAdminMedia = async (file: File) => {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  return request<MediaAsset>('/api/admin/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, base64Data }),
  });
};

export const updateAdminMedia = (id: string, changes: Pick<MediaAsset, 'altText' | 'title'>) => request<MediaAsset>(
  `/api/admin/media/${encodeURIComponent(id)}`,
  { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) },
);
