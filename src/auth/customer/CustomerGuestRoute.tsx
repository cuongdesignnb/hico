import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCustomerAuth } from './useCustomerAuth';

export const CustomerGuestRoute = ({ children }: { children: ReactNode }) => {
  const { status } = useCustomerAuth();
  if (status === 'loading') return <main className="route-state" role="status">Dang kiem tra phien dang nhap...</main>;
  if (status === 'authenticated') return <Navigate to="/tai-khoan" replace />;
  return <>{children}</>;
};
