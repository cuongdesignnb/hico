export interface Customer {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  emailVerified: boolean;
  status: 'pending_verification' | 'active' | 'disabled' | 'locked';
}

export type CustomerAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface CustomerAuthContextValue {
  status: CustomerAuthStatus;
  customer: Customer | null;
  error: string | null;
  csrfToken: string;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  reauth: (password: string) => Promise<void>;
}
