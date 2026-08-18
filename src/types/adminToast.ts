export type AdminToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface AdminToastOptions {
  title?: string;
  duration?: number;
  persistent?: boolean;
}

export interface AdminToast {
  id: string;
  variant: AdminToastVariant;
  title?: string;
  message: string;
  duration: number;
  persistent: boolean;
  createdAt: number;
}

export interface AdminToastApi {
  success: (message: string, options?: AdminToastOptions) => string;
  error: (message: string, options?: AdminToastOptions) => string;
  warning: (message: string, options?: AdminToastOptions) => string;
  info: (message: string, options?: AdminToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}
