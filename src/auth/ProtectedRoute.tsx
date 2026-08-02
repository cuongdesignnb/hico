import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './useAuth';

export const ProtectedRoute = ({ children, permission = 'admin.dashboard.read' }: { children: ReactNode; permission?: string }) => {
  const { status, hasPermission } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <main className="route-state" role="status">Checking session...</main>;
  if (status === 'anonymous') return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  if (!hasPermission(permission)) return <Navigate to="/khong-co-quyen" replace />;
  return <>{children}</>;
};
