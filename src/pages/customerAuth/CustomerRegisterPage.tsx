import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';

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
      setError(requestError instanceof Error ? requestError.message : 'Khong the tao tai khoan.');
    } finally {
      setSubmitting(false);
    }
  };
  return <main className="route-state auth-page"><form className="auth-form" onSubmit={submit}>
    <h1>Tao tai khoan</h1>
    <label>Ho ten<input autoComplete="name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></label>
    <label>Email<input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
    <label>So dien thoai (tuy chon)<input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
    <label>Mat khau<input type="password" minLength={12} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={submitting}>{submitting ? 'Dang tao...' : 'Tao tai khoan'}</button>
    <p><Link to="/dang-nhap">Da co tai khoan?</Link></p>
  </form></main>;
};
