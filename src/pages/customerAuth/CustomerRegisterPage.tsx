import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';
import { viAuth } from '../../i18n/vi/auth';

export const CustomerRegisterPage = () => {
  const { register } = useCustomerAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await register(form);
      navigate('/xac-thuc-email', { replace: true, state: { requested: true } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tạo tài khoản.');
    } finally {
      setSubmitting(false);
    }
  };
  return <main className="route-state auth-page"><form className="auth-form" onSubmit={submit}>
    <h1>{viAuth.register}</h1>
    <label>Họ tên<input autoComplete="name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></label>
    <label>{viAuth.email}<input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
    <label>Số điện thoại (tùy chọn)<input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
    <label>{viAuth.password}<input type="password" minLength={12} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={submitting}>{submitting ? viAuth.registerPending : viAuth.register}</button>
    <p><Link to="/dang-nhap">Đã có tài khoản?</Link></p>
  </form></main>;
};
