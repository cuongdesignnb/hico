import { useContext } from 'react';
import { AdminToastContext } from '../components/Admin/Toast/AdminToastContext';

export const useAdminToast = () => {
  const context = useContext(AdminToastContext);
  if (!context) throw new Error('useAdminToast must be used within AdminToastProvider.');
  return context;
};
