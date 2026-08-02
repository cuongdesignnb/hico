const BulkArchiveForm = ({ restore }: { restore: boolean }) => <p className="catalog-bulk-form-note">{restore ? 'Mục đã chọn sẽ được khôi phục về bản nháp.' : 'Mục đã chọn sẽ được lưu trữ; dữ liệu gốc vẫn được giữ trong lịch sử catalog.'}</p>;

export default BulkArchiveForm;
