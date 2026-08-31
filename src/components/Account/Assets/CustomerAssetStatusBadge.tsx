import type { CustomerAssetStatus } from '../../../types/customerAsset';
import { getAssetStatusLabel } from '../../../utils/customerStatusLabels';

export const CustomerAssetStatusBadge = ({ status }: { status: CustomerAssetStatus | string }) => <span className={`order-status order-status-${status.toLowerCase()}`}>{getAssetStatusLabel(status)}</span>;
