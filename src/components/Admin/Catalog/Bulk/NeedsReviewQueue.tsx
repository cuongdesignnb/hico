import type { NeedsReviewItem, QueueResponse } from '../../../../types/catalogQueue';

const statusLabels: Record<string, string> = {
  NOT_FOUND: 'Không tìm thấy nguồn cấp',
  MISSING_WMPRODUCT_ID: 'Thiếu mã nguồn cấp',
  TYPE_CONFLICT: 'Không khớp loại gói',
  LEGACY_CONFLICT: 'Xung đột dữ liệu cũ',
  INACTIVE_PROVIDER_OFFER: 'Nguồn cấp đã tắt',
  IGNORED_BY_ADMIN: 'Đã bỏ qua theo xác nhận',
  MANUAL_PROCESSING: 'Xử lý thủ công',
  NEEDS_REVIEW: 'Cần Admin kiểm tra',
};

const NeedsReviewQueue = ({ data }: { data: QueueResponse<NeedsReviewItem> | null }) => <div className="catalog-queue-list">{data?.items.length ? data.items.map((item) => <div className="catalog-queue-item" key={item.id}><strong>{item.productName ?? item.productId}</strong><span>{item.sku} · {statusLabels[item.status] ?? 'Cần Admin kiểm tra'}</span><small>Đang chờ xử lý</small></div>) : <span className="catalog-queue-empty">Không có mục cần review.</span>}</div>;

export default NeedsReviewQueue;
