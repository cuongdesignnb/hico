import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../services/customerAuthApi';

export const CustomerForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await requestPasswordReset(email).catch(() => undefined);
    setSubmitted(true);
  };
  return <main className="route-state auth-page"><form className="auth-form" onSubmit={submit}>
    <h1>Quen mat khau</h1>
    <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    {submitted && <p role="status">Neu tai khoan ton tai, huong dan dat lai mat khau da duoc gui.</p>}
    <button type="submit">Gui huong dan</button>
    <p><Link to="/dang-nhap">Quay lai dang nhap</Link></p>
  </form></main>;
};
