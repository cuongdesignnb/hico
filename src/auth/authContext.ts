import { createContext } from 'react';
import type { AuthStatus, AuthUser } from './authTypes';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
