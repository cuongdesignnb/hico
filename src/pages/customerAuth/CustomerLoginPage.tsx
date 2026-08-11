import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';
import { viAuth } from '../../i18n/vi/auth';

const safeReturnTo = (value: unknown) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/tai-khoan';

export const CustomerLoginPage = () => {
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate(safeReturnTo((location.state as { returnTo?: string } | null)?.returnTo), { replace: true });
    } catch {
      setError(viAuth.invalidCredentials);
    } finally {
      setSubmitting(false);
    }
  };
  return <main className="route-state auth-page"><form className="auth-form" onSubmit={submit}>
    <h1>{viAuth.login}</h1>
    <label>{viAuth.email}<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>{viAuth.password}<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={submitting}>{submitting ? viAuth.loginPending : viAuth.login}</button>
    <p><Link to="/quen-mat-khau">{viAuth.forgotPassword}?</Link> <Link to="/dang-ky">{viAuth.register}</Link></p>
  </form></main>;
};
