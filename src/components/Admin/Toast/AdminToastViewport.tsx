import React from 'react';
import type { AdminToast } from '../../../types/adminToast';
import { AdminToastItem } from './AdminToastItem';

interface Props {
  toasts: AdminToast[];
  onDismiss: (id: string) => void;
}

export const AdminToastViewport: React.FC<Props> = ({ toasts, onDismiss }) => (
  <div className="admin-toast-viewport" aria-live="polite" aria-atomic="false" aria-label="Thông báo Admin">
    {toasts.map((toast) => <AdminToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />)}
  </div>
);
