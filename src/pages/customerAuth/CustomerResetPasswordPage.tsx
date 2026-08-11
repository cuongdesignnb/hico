import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../services/customerAuthApi';
import { viAuth } from '../../i18n/vi/auth';

export const CustomerResetPasswordPage = () => {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await resetPassword(params.get('token') ?? '', password);
      setMessage(viAuth.passwordResetSuccess);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : viAuth.invalidResetLink);
    }
  };
  return <main className="route-state auth-page"><form className="auth-form" onSubmit={submit}>
    <h1>{viAuth.resetPassword}</h1>
    <label>{viAuth.newPassword}<input type="password" minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <button type="submit">{viAuth.resetPassword}</button><p><Link to="/dang-nhap">{viAuth.login}</Link></p>
  </form></main>;
};
