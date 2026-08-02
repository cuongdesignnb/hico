import { CheckCircle2, X } from 'lucide-react';
import type { BulkExecuteResponse } from '../../../../types/catalogBulk';

const BulkResultDialog = ({ result, onClose }: { result: BulkExecuteResponse | null; onClose: () => void }) => {
  if (!result) return null;
  return <div className="catalog-dialog-backdrop" role="presentation"><div className="catalog-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-result-title"><div className="catalog-dialog-heading"><div><CheckCircle2 size={20} /><h3 id="bulk-result-title">Đã cập nhật danh mục</h3></div><button type="button" className="catalog-icon-button" onClick={onClose} aria-label="Đóng"><X size={16} /></button></div><p>{result.affectedCount.toLocaleString('vi-VN')} mục đã được cập nhật trong một phiên bản catalog.</p><div className="catalog-bulk-result-meta"><span>Trạng thái</span><strong>Đã ghi atomically</strong></div><button type="button" className="catalog-primary-button" onClick={onClose}>Đóng</button></div></div>;
};

export default BulkResultDialog;
