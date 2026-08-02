import { RefreshCw } from 'lucide-react';

interface VersionConflictDialogProps {
  message: string;
  onReload: () => void;
  onCancel: () => void;
}

const VersionConflictDialog = ({ message, onReload, onCancel }: VersionConflictDialogProps) => (
  <div className="product-wizard-dialog-backdrop" role="presentation">
    <section className="product-wizard-dialog" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <RefreshCw size={22} />
      <h3 id="conflict-title">Dữ liệu đã có phiên bản mới</h3>
      <p>{message}</p>
      <div className="product-wizard-dialog-actions">
        <button type="button" className="product-wizard-secondary-button" onClick={onCancel}>Hủy</button>
        <button type="button" className="product-wizard-primary-button" onClick={onReload}><RefreshCw size={16} /> Tải lại dữ liệu</button>
      </div>
    </section>
  </div>
);

export default VersionConflictDialog;
