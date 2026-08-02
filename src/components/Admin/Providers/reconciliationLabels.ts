import type {
  ReconciliationResolution,
  ReconciliationStatus,
} from '../../../types/reconciliation';

export const RECONCILIATION_STATUS_LABELS: Record<
  ReconciliationStatus,
  string
> = {
  MATCHED: 'Đã khớp',
  NOT_FOUND: 'Không tìm thấy',
  DUPLICATE_PROVIDER_OFFER: 'Trùng offer',
  TYPE_CONFLICT: 'Xung đột loại',
  LEGACY_CONFLICT: 'Xung đột legacy',
  MISSING_WMPRODUCT_ID: 'Thiếu wmproductId',
  INACTIVE_PROVIDER_OFFER: 'Offer ngừng cung cấp',
  NEEDS_REVIEW: 'Cần xác nhận',
  CONFIRMED_BY_ADMIN: 'Admin đã xác nhận',
  IGNORED_BY_ADMIN: 'Tạm bỏ qua',
};

export const RECONCILIATION_RESOLUTION_LABELS: Record<
  ReconciliationResolution,
  string
> = {
  WORLDMOVE_ESIM_REDEEM: 'Worldmove eSIM tự động',
  WORLDMOVE_ESIM_ORDER_THEN_REDEEM: 'eSIM nhà mạng địa phương',
  WORLDMOVE_PHYSICAL_ORDER: 'SIM vật lý Worldmove',
  WORLDMOVE_TOPUP: 'Top-up Worldmove',
  HICO_MANUAL_QR: 'QR riêng HICO',
  HICO_PHYSICAL_STOCK: 'SIM kho HICO',
  MANUAL_PROCESSING: 'Xử lý thủ công',
};

export const getReconciliationStatusTone = (
  status: ReconciliationStatus,
) => {
  if (status === 'MATCHED' || status === 'CONFIRMED_BY_ADMIN') return 'success';
  if (status === 'IGNORED_BY_ADMIN') return 'muted';
  if (
    status === 'TYPE_CONFLICT'
    || status === 'LEGACY_CONFLICT'
    || status === 'DUPLICATE_PROVIDER_OFFER'
  ) return 'danger';
  return 'warning';
};
