import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthStatus, AuthUser } from './authTypes';
import * as authApi from '../services/authApi';
import { AuthContext } from './authContext';
const writes = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const announceLogout = () => {
  if (!('BroadcastChannel' in window)) return;
  const channel = new BroadcastChannel('hico-admin-auth');
  channel.postMessage({ type: 'logout' });
  channel.close();
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState('');

  const setAuthenticated = useCallback((payload: { user: AuthUser; csrfToken: string }) => {
    setUser(payload.user);
    setCsrfToken(payload.csrfToken);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    let active = true;
    authApi.getCurrentAuth().then((payload) => { if (active) setAuthenticated(payload); }).catch(() => { if (active) setStatus('anonymous'); });
    return () => { active = false; };
  }, [setAuthenticated]);

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return undefined;
    const channel = new BroadcastChannel('hico-admin-auth');
    channel.onmessage = (event) => {
      if (event.data?.type === 'logout') { setUser(null); setCsrfToken(''); setStatus('anonymous'); }
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (!url.startsWith('/api/admin/') || !writes.has(method) || !csrfToken) return nativeFetch(input, init);
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      headers.set('X-CSRF-Token', csrfToken);
      const retryInput = input instanceof Request ? input.clone() : input;
      const response = await nativeFetch(input, { ...init, credentials: 'include', headers });
      if (response.status !== 401) return response;
      try {
        const refreshed = await authApi.refresh(csrfToken);
        setAuthenticated(refreshed);
        headers.set('X-CSRF-Token', refreshed.csrfToken);
        return nativeFetch(retryInput, { ...init, credentials: 'include', headers });
      } catch {
        announceLogout(); setUser(null); setCsrfToken(''); setStatus('anonymous');
      }
      return response;
    };
    return () => { window.fetch = nativeFetch; };
  }, [csrfToken, setAuthenticated]);

  const login = useCallback(async (email: string, password: string) => setAuthenticated(await authApi.login(email, password)), [setAuthenticated]);
  const logout = useCallback(async () => {
    if (csrfToken) await authApi.logout(csrfToken).catch(() => undefined);
    announceLogout(); setUser(null); setCsrfToken(''); setStatus('anonymous');
  }, [csrfToken]);
  const hasPermission = useCallback((permission: string) => Boolean(user?.permissions.includes('*') || user?.permissions.includes(permission)), [user]);
  const value = useMemo(() => ({ status, user, login, logout, hasPermission }), [hasPermission, login, logout, status, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
