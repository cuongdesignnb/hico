import { createContext } from 'react';
import type { CustomerAuthContextValue } from './customerAuthTypes';

export const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);
