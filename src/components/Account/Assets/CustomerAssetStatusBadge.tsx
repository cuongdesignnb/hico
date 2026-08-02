import type { CustomerAssetStatus } from '../../../types/customerAsset';

const labels: Record<string, string> = {
  PENDING_CALLBACK: 'Dang xu ly',
  PENDING_QR_ASSIGN: 'Dang gan QR',
  PROVISIONED: 'Da kich hoat',
  PENDING_SHIP: 'Cho giao hang',
  SHIPPED: 'Da giao hang',
  CANCELLED: 'Da huy',
};

export const CustomerAssetStatusBadge = ({ status }: { status: CustomerAssetStatus | string }) => <span className={`order-status order-status-${status.toLowerCase()}`}>{labels[status] ?? status}</span>;
