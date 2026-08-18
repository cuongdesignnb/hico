import React from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import type { AdminToast } from '../../../types/adminToast';

interface Props {
  toast: AdminToast;
  onDismiss: (id: string) => void;
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
} as const;

export const AdminToastItem: React.FC<Props> = ({ toast, onDismiss }) => {
  const Icon = icons[toast.variant];
  return <div className={`admin-toast-item admin-toast-${toast.variant}`} role={toast.variant === 'error' ? 'alert' : 'status'}>
    <Icon className="admin-toast-icon" size={20} aria-hidden="true" />
    <div className="admin-toast-content">
      {toast.title && <strong>{toast.title}</strong>}
      <span>{toast.message}</span>
    </div>
    <button type="button" className="admin-toast-close" aria-label="Đóng thông báo" onClick={() => onDismiss(toast.id)}>
      <X size={17} aria-hidden="true" />
    </button>
  </div>;
};
