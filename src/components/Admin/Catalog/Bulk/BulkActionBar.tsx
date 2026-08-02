import { Eye, ListFilter, X } from 'lucide-react';
import type { BulkEntityType } from '../../../../types/catalogBulk';

export type BulkOperationType = 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE' | 'ADJUST_PRICE' | 'SET_PRICE' | 'SET_COMPARE_PRICE' | 'CLEAR_COMPARE_PRICE' | 'SET_PROVIDER_MAPPING' | 'CLEAR_PROVIDER_MAPPING' | 'SET_FULFILLMENT_SOURCE' | 'RUN_READINESS' | 'SET_FEATURED' | 'UNSET_FEATURED';

interface BulkActionBarProps {
  entityType: BulkEntityType;
  operation: BulkOperationType;
  selectedCount: number;
  isFilterSelection: boolean;
  onEntityTypeChange: (value: BulkEntityType) => void;
  onOperationChange: (value: BulkOperationType) => void;
  onSelectFilter: () => void;
  onClear: () => void;
  onPreview: () => void;
}

const BulkActionBar = ({ entityType, operation, selectedCount, isFilterSelection, onEntityTypeChange, onOperationChange, onSelectFilter, onClear, onPreview }: BulkActionBarProps) => (
  <div className="catalog-bulk-bar">
    <div className="catalog-bulk-controls">
      <label>
        <span>Đối tượng</span>
        <select value={entityType} onChange={(event) => onEntityTypeChange(event.target.value as BulkEntityType)}>
          <option value="product">Sản phẩm</option>
          <option value="variant">Gói bán</option>
        </select>
      </label>
      <label>
        <span>Thao tác hàng loạt</span>
        <select value={operation} onChange={(event) => onOperationChange(event.target.value as BulkOperationType)}>
          <option value="PUBLISH">Đưa lên bán</option>
          <option value="UNPUBLISH">Tạm ngừng bán</option>
          <option value="ARCHIVE">Lưu trữ</option>
          <option value="RESTORE">Khôi phục</option>
          <option value="SET_PRICE">Đặt giá bán</option>
          <option value="ADJUST_PRICE">Điều chỉnh giá</option>
          <option value="SET_COMPARE_PRICE">Đặt giá niêm yết</option>
          <option value="CLEAR_COMPARE_PRICE">Xóa giá niêm yết</option>
          <option value="SET_PROVIDER_MAPPING">Chọn nguồn cấp</option>
          <option value="CLEAR_PROVIDER_MAPPING">Gỡ nguồn cấp</option>
          <option value="SET_FULFILLMENT_SOURCE">Đổi hình thức cấp</option>
          <option value="RUN_READINESS">Kiểm tra điều kiện bán</option>
          <option value="SET_FEATURED">Đánh dấu nổi bật</option>
          <option value="UNSET_FEATURED">Bỏ nổi bật</option>
        </select>
      </label>
    </div>
    <div className="catalog-bulk-actions">
      <button type="button" className="catalog-secondary-button" onClick={onSelectFilter}>
        <ListFilter size={15} /> Chọn theo bộ lọc
      </button>
      {(selectedCount > 0 || isFilterSelection) && (
        <>
          <span className="catalog-bulk-count">{isFilterSelection ? 'Toàn bộ bộ lọc' : `${selectedCount.toLocaleString('vi-VN')} đã chọn`}</span>
          <button type="button" className="catalog-icon-button" onClick={onClear} aria-label="Bỏ chọn" title="Bỏ chọn"><X size={16} /></button>
          <button type="button" className="catalog-primary-button" onClick={onPreview}><Eye size={15} /> Xem trước</button>
        </>
      )}
    </div>
  </div>
);

export default BulkActionBar;
