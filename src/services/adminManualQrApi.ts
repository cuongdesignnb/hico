import type { ManualQr } from '../types/legacy';

const jsonOrError = async (response: Response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Không thể xử lý kho QR.');
  return body;
};

export const listAdminManualQrs = async (): Promise<ManualQr[]> => {
  const response = await fetch('/api/admin/manual-qrs', { headers: { Accept: 'application/json' } });
  const body = await jsonOrError(response);
  return Array.isArray(body) ? body : [];
};

export const uploadAdminManualQr = async (variantId: string, file: File): Promise<ManualQr> => {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc ảnh QR.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
  const response = await fetch('/api/admin/manual-qrs/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ variantId, base64Data }),
  });
  return jsonOrError(response) as Promise<ManualQr>;
};

export const assignAdminManualQr = async ({ orderId, orderItemId, qrId }: { orderId: string; orderItemId: string; qrId: string }) => {
  const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/assign-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ orderItemId, qrId }),
  });
  return jsonOrError(response) as Promise<{ orderId: string; state: string; manualQrId: string | null }>;
};
