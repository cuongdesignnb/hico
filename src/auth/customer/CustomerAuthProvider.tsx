import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as customerAuthApi from '../../services/customerAuthApi';
import { CustomerAuthContext } from './CustomerAuthContext';
import type { Customer, CustomerAuthStatus } from './customerAuthTypes';

const announceLogout = () => {
  if (!('BroadcastChannel' in window)) return;
  const channel = new BroadcastChannel('hico-customer-auth');
  channel.postMessage({ type: 'logout' });
  channel.close();
};

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<CustomerAuthStatus>('loading');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setAuthenticated = useCallback((payload: { customer: Customer; csrfToken: string }) => {
    setCustomer(payload.customer);
    setCsrfToken(payload.csrfToken);
    setError(null);
    setStatus('authenticated');
  }, []);

  const clear = useCallback(() => {
    setCustomer(null);
    setCsrfToken('');
    setError(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    let active = true;
    customerAuthApi.getCurrentCustomer()
      .then((payload) => { if (active) setAuthenticated(payload); })
      .catch((requestError: { status?: number; message?: string }) => {
        if (!active) return;
        if (requestError.status === 401) clear();
        else {
          setCustomer(null);
          setCsrfToken('');
          setError(requestError.message ?? 'Customer authentication is unavailable.');
          setStatus('error');
        }
      });
    return () => { active = false; };
  }, [clear, setAuthenticated]);

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return undefined;
    const channel = new BroadcastChannel('hico-customer-auth');
    channel.onmessage = (event) => { if (event.data?.type === 'logout') clear(); };
    return () => channel.close();
  }, [clear]);

  const login = useCallback(async (email: string, password: string) => {
    setAuthenticated(await customerAuthApi.login(email, password));
  }, [setAuthenticated]);

  const register = useCallback(async (input: { email: string; password: string; displayName: string; phone?: string }) => {
    await customerAuthApi.register(input);
    clear();
  }, [clear]);

  const logout = useCallback(async () => {
    if (csrfToken) await customerAuthApi.logout(csrfToken).catch(() => undefined);
    announceLogout();
    clear();
  }, [clear, csrfToken]);

  const refresh = useCallback(async () => {
    if (!csrfToken) throw new Error('Customer session is unavailable.');
    setAuthenticated(await customerAuthApi.refresh(csrfToken));
  }, [csrfToken, setAuthenticated]);

  const value = useMemo(() => ({ status, customer, error, login, register, logout, refresh }), [customer, error, login, logout, refresh, register, status]);
  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
};
