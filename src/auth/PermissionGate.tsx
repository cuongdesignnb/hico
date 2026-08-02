import { useAuth } from './useAuth';
import type { ReactNode } from 'react';

export const PermissionGate = ({ permission, children, fallback = null }: { permission: string; children: ReactNode; fallback?: ReactNode }) => {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
};
