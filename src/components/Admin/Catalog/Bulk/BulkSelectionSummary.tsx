interface BulkSelectionSummaryProps {
  count: number;
  isFilterSelection: boolean;
  onClear: () => void;
}

const BulkSelectionSummary = ({ count, isFilterSelection, onClear }: BulkSelectionSummaryProps) => (
  <div className="catalog-bulk-selection">
    <strong>{isFilterSelection ? 'Toàn bộ kết quả bộ lọc' : `${count.toLocaleString('vi-VN')} mục đã chọn`}</strong>
    <span>{isFilterSelection ? 'Selection sẽ được tính lại ở máy chủ.' : 'Sẵn sàng xem trước thay đổi.'}</span>
    <button type="button" className="catalog-text-button" onClick={onClear}>Bỏ chọn</button>
  </div>
);

export default BulkSelectionSummary;
