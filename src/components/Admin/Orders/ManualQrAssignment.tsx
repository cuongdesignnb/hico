import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, RefreshCw, Upload } from 'lucide-react';
import type { AdminOrder, AdminOrderItem, ManualQr } from '../../../types/legacy';
import { assignAdminManualQr, listAdminManualQrs, uploadAdminManualQr } from '../../../services/adminManualQrApi';
import './ManualQrAssignment.css';

interface ManualQrAssignmentProps {
  order: AdminOrder;
  onRefresh: () => void;
}

type AssignableItem = AdminOrderItem & { index: number; resolvedOrderItemId: string; resolvedVariantId: string };

const orderItemIdFor = (orderId: string, item: AdminOrderItem, index: number) => item.orderItemId || `${orderId}:item:${index}`;

export const ManualQrAssignment = ({ order, onRefresh }: ManualQrAssignmentProps) => {
  const [qrPool, setQrPool] = useState<ManualQr[]>([]);
  const [selectedQr, setSelectedQr] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo<AssignableItem[]>(() => (order.items ?? [])
    .map((item, index) => ({
      ...item,
      index,
      resolvedOrderItemId: orderItemIdFor(order.orderId, item, index),
      resolvedVariantId: item.variantId ?? '',
    }))
    .filter((item) => item.fulfillmentMethod === 'HICO_MANUAL_QR' || item.medium === 'esim' || item.simType === 'manual'), [order]);

  const refreshQrs = useCallback(async () => {
    try {
      setError(null);
      setQrPool(await listAdminManualQrs());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải kho QR.');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refreshQrs(); }, 0);
    return () => clearTimeout(timer);
  }, [order.orderId, refreshQrs]);

  const availableFor = (variantId: string) => qrPool.filter((qr) => (
    qr.id
    && qr.variantId === variantId
    && !qr.assignedOrderId
    && qr.hasImage !== false
  ));

  const handleUpload = async (item: AssignableItem, file: File) => {
    if (!item.resolvedVariantId) {
      setError('Đơn hàng chưa có variantId canonical để gán QR.');
      return;
    }
    const key = `upload:${item.resolvedOrderItemId}`;
    setBusyKey(key);
    try {
      setError(null);
      const created = await uploadAdminManualQr(item.resolvedVariantId, file);
      await refreshQrs();
      if (created.id) setSelectedQr((current) => ({ ...current, [item.resolvedOrderItemId]: created.id ?? '' }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải ảnh QR lên.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleAssign = async (item: AssignableItem) => {
    const qrId = selectedQr[item.resolvedOrderItemId];
    if (!qrId || !item.resolvedVariantId) return;
    const key = `assign:${item.resolvedOrderItemId}`;
    setBusyKey(key);
    try {
      setError(null);
      await assignAdminManualQr({ orderId: order.orderId, orderItemId: item.resolvedOrderItemId, qrId });
      await refreshQrs();
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gán QR.');
    } finally {
      setBusyKey(null);
    }
  };

  if (order.status !== 'PENDING_QR_ASSIGN') return null;

  return (
    <div className="manual-qr-assignment" role="group" aria-label="Gán QR eSIM thủ công">
      <div className="manual-qr-assignment-heading">
        <div>
          <strong>Gán QR eSIM</strong>
          <span>Chọn đúng QR theo variant của từng dòng đơn hàng.</span>
        </div>
        <button type="button" className="manual-qr-icon-button" onClick={() => void refreshQrs()} title="Làm mới kho QR" aria-label="Làm mới kho QR">
          <RefreshCw size={14} />
        </button>
      </div>
      {error && <p className="manual-qr-error" role="alert">{error}</p>}
      {items.length === 0 && <p className="manual-qr-empty">Đơn hàng chưa có order item eSIM canonical để gán.</p>}
      {items.map((item) => {
        const available = availableFor(item.resolvedVariantId);
        const selected = selectedQr[item.resolvedOrderItemId] ?? '';
        const busy = busyKey === `assign:${item.resolvedOrderItemId}` || busyKey === `upload:${item.resolvedOrderItemId}`;
        return (
          <div className="manual-qr-assignment-row" key={item.resolvedOrderItemId}>
            <div className="manual-qr-item-meta">
              <span>{item.productName || 'eSIM thủ công'}</span>
              <small>Variant: {item.resolvedVariantId || 'chưa có'}</small>
            </div>
            <div className="manual-qr-actions">
              <select aria-label="Chọn QR chưa gán" value={selected} onChange={(event) => setSelectedQr((current) => ({ ...current, [item.resolvedOrderItemId]: event.target.value }))} disabled={busy || !item.resolvedVariantId}>
                <option value="">{available.length ? 'Chọn QR chưa gán' : 'Chưa có QR phù hợp'}</option>
                {available.map((qr) => <option key={qr.id} value={qr.id}>{qr.id}</option>)}
              </select>
              <label className="manual-qr-upload-button" title="Tải ảnh QR mới">
                {busyKey === `upload:${item.resolvedOrderItemId}` ? <LoaderCircle className="manual-qr-spin" size={14} /> : <Upload size={14} />}
                <span>Tải QR</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(item, file); event.currentTarget.value = ''; }} />
              </label>
              <button type="button" className="manual-qr-assign-button" disabled={!selected || busy || !item.resolvedVariantId} onClick={() => void handleAssign(item)}>
                {busyKey === `assign:${item.resolvedOrderItemId}` ? <LoaderCircle className="manual-qr-spin" size={14} /> : <Check size={14} />}
                <span>Gán QR</span>
              </button>
            </div>
          </div>
        );
      })}
      <div className="manual-qr-assignment-note"><ImagePlus size={14} /> QR vẫn nằm trong private storage, không lộ storage key.</div>
    </div>
  );
};

export default ManualQrAssignment;
