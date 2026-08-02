import type { BulkOperationType } from './BulkActionBar';

const labels: Partial<Record<BulkOperationType, string>> = {
  PUBLISH: 'Các mục đủ điều kiện sẽ được đưa lên bán. Mục bị chặn sẽ làm bulk không thực thi.',
  UNPUBLISH: 'Các mục được chọn sẽ chuyển về trạng thái tạm ngừng bán.',
  ARCHIVE: 'Các mục sẽ được lưu trữ và không còn khả dụng trong luồng bán.',
  RESTORE: 'Các mục sẽ trở lại trạng thái bản nháp để tiếp tục kiểm tra.',
  RUN_READINESS: 'Chỉ kiểm tra điều kiện bán, không ghi thay đổi.',
  SET_FEATURED: 'Sản phẩm sẽ được đánh dấu nổi bật.',
  UNSET_FEATURED: 'Sản phẩm sẽ bỏ đánh dấu nổi bật.',
};

const BulkStatusForm = ({ operation }: { operation: BulkOperationType }) => <p className="catalog-bulk-form-note">{labels[operation] ?? 'Kiểm tra lại thay đổi trước khi thực thi.'}</p>;

export default BulkStatusForm;
