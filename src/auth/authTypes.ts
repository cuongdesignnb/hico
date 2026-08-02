export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';
