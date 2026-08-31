import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../services/customerAuthApi';
import { viAuth } from '../../i18n/vi/auth';

export const CustomerForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await requestPasswordReset(email).catch(() => undefined);
    setSubmitted(true);
  };
  return <main className="route-state auth-page"><form className="auth-form" onSubmit={submit}>
    <h1>{viAuth.forgotPassword}</h1>
    <label>{viAuth.email}<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    {submitted && <p role="status">{viAuth.forgotPasswordSent}</p>}
    <button type="submit">Gửi hướng dẫn</button>
    <p><Link to="/dang-nhap">Quay lại đăng nhập</Link></p>
  </form></main>;
};
