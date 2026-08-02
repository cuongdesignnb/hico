import type { CustomerOrderStatus } from '../../types/customerOrder';

const labels: Record<string, string> = { PENDING: 'Cho xu ly', PROCESSING: 'Dang xu ly', PROVISIONED: 'Da kich hoat', SHIPPED: 'Da giao', COMPLETED: 'Hoan tat', CANCELLED: 'Da huy' };
export const OrderStatusBadge = ({ status }: { status: CustomerOrderStatus }) => <span className={`order-status order-status-${status.toLowerCase()}`}>{labels[status] ?? status}</span>;
