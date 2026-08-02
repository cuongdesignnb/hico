import { AlertTriangle } from 'lucide-react';

interface UnsavedChangesDialogProps {
  onContinue: () => void;
  onDiscard: () => void;
}

const UnsavedChangesDialog = ({ onContinue, onDiscard }: UnsavedChangesDialogProps) => (
  <div className="product-wizard-dialog-backdrop" role="presentation">
    <section className="product-wizard-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
      <AlertTriangle size={22} />
      <h3 id="unsaved-title">Có thay đổi chưa được lưu</h3>
      <p>Nếu đóng lúc này, các chỉnh sửa trong wizard sẽ bị bỏ.</p>
      <div className="product-wizard-dialog-actions">
        <button type="button" className="product-wizard-secondary-button" onClick={onContinue}>Tiếp tục chỉnh sửa</button>
        <button type="button" className="product-wizard-danger-button" onClick={onDiscard}>Bỏ thay đổi</button>
      </div>
    </section>
  </div>
);

export default UnsavedChangesDialog;
