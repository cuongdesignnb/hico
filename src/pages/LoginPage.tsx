import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

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
      setError('Email or password is incorrect.');
    } finally { setSubmitting(false); }
  };
  if (status === 'authenticated') return null;
  return <main className="route-state auth-page"><form className="auth-form" onSubmit={submit}><h1>Admin sign in</h1><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p role="alert">{error}</p>}<button type="submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button></form></main>;
};

export const ForbiddenPage = () => <main className="route-state"><h1>Permission denied</h1><p>Your account does not have access to this area.</p></main>;
