import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from './useCustomerAuth';

const safeReturnTo = (location: ReturnType<typeof useLocation>) => {
  const value = `${location.pathname}${location.search}`;
  return value.startsWith('/') && !value.startsWith('//') ? value : '/tai-khoan';
};

export const CustomerProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { status, error } = useCustomerAuth();
  const location = useLocation();
  if (status === 'loading') return <main className="route-state" role="status">Dang kiem tra phien dang nhap...</main>;
  if (status === 'error') return <main className="route-state" role="alert">Khong the ket noi dich vu tai khoan. {error}</main>;
  if (status !== 'authenticated') return <Navigate to="/dang-nhap" replace state={{ returnTo: safeReturnTo(location) }} />;
  return <>{children}</>;
};
