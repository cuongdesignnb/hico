import type { CustomerAssetStatus } from '../types/customerAsset';
import type { CustomerOrderStatus } from '../types/customerOrder';
import type { ReferralStatus } from '../types/referral';

export const orderStatusLabels: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  PROCESSING: 'Đang xử lý',
  PROVISIONED: 'Đã kích hoạt',
  SHIPPED: 'Đã giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  FAILED: 'Nạp thất bại',
  FAILED_RETRYABLE: 'Đang chờ xử lý lại',
};

export const assetStatusLabels: Record<string, string> = {
  PENDING_CALLBACK: 'Đang xử lý',
  PENDING_QR_ASSIGN: 'Đang gán QR',
  PROVISIONED: 'Đã kích hoạt',
  PENDING_SHIP: 'Chờ giao hàng',
  SHIPPED: 'Đã giao hàng',
  CANCELLED: 'Đã hủy',
};

export const referralStatusLabels: Record<ReferralStatus, string> = {
  PENDING: 'Đang chờ điều kiện',
  QUALIFIED: 'Đã đủ điều kiện',
  REWARDED: 'Đã ghi nhận',
  REVERSED: 'Đã hoàn',
  REJECTED: 'Đã từ chối',
  MANUAL_REVIEW: 'Đang được xem xét',
};

export const notificationStatusLabels: Record<string, string> = {
  UNREAD: 'Chưa đọc',
  READ: 'Đã đọc',
  ARCHIVED: 'Đã lưu trữ',
};

export const ticketStatusLabels: Record<string, string> = {
  OPEN: 'Đang mở',
  PENDING: 'Đang chờ xử lý',
  CLOSED: 'Đã đóng',
};

export const verificationStatusLabels: Record<string, string> = {
  PENDING: 'Chờ xác thực',
  VERIFIED: 'Đã xác thực',
  EXPIRED: 'Đã hết hạn',
};

export const sessionStatusLabels: Record<string, string> = {
  CURRENT: 'Phiên hiện tại',
  OTHER: 'Phiên khác',
  REVOKED: 'Đã thu hồi',
};

export const getOrderStatusLabel = (status: CustomerOrderStatus) => orderStatusLabels[status] ?? status;
export const getAssetStatusLabel = (status: CustomerAssetStatus | string) => assetStatusLabels[status] ?? status;
