import { AlertTriangle, X } from 'lucide-react';

interface ConflictAlertProps {
  message: string;
  onDismiss?: () => void;
}

const ConflictAlert = ({ message, onDismiss }: ConflictAlertProps) => (
  <div className="product-wizard-alert product-wizard-alert-error" role="alert">
    <AlertTriangle size={18} />
    <span>{message}</span>
    {onDismiss && (
      <button type="button" className="product-wizard-alert-close" onClick={onDismiss} aria-label="Bỏ thông báo">
        <X size={15} />
      </button>
    )}
  </div>
);

export default ConflictAlert;
