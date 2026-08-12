import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import './LoginPage.css';

export const LoginPage = () => {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from || '/quan-tri', { replace: true });
    } catch {
      setError('Email hoặc mật khẩu không chính xác.');
    } finally { setSubmitting(false); }
  };
  if (status === 'authenticated') return null;
  return <main className="admin-auth-page"><form className="admin-auth-form" onSubmit={submit}><div className="admin-auth-eyebrow">HICO ADMIN</div><h1>Đăng nhập quản trị</h1><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p role="alert">{error}</p>}<button type="submit" disabled={submitting}>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</button></form></main>;
};

export const ForbiddenPage = () => <main className="route-state"><h1>Permission denied</h1><p>Your account does not have access to this area.</p></main>;
