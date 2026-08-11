import type { CustomerOrderStatus } from '../../types/customerOrder';
import { getOrderStatusLabel } from '../../utils/customerStatusLabels';

export const OrderStatusBadge = ({ status }: { status: CustomerOrderStatus }) => <span className={`order-status order-status-${status.toLowerCase()}`}>{getOrderStatusLabel(status)}</span>;
