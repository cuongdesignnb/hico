import { createContext } from 'react';
import type { AdminToastApi } from '../../../types/adminToast';

export const AdminToastContext = createContext<AdminToastApi | null>(null);
