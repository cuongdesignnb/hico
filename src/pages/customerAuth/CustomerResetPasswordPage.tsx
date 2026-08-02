import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../services/customerAuthApi';

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
      setMessage('Mat khau da duoc dat lai. Hay dang nhap lai.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Lien ket dat lai mat khau khong hop le.');
    }
  };
  return <main className="route-state auth-page"><form className="auth-form" onSubmit={submit}>
    <h1>Dat lai mat khau</h1>
    <label>Mat khau moi<input type="password" minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <button type="submit">Dat lai mat khau</button><p><Link to="/dang-nhap">Dang nhap</Link></p>
  </form></main>;
};
