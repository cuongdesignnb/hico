import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../../services/customerAuthApi';

export const CustomerVerifyEmailPage = () => {
  const [params] = useSearchParams();
  const location = useLocation();
  const [message, setMessage] = useState((location.state as { requested?: boolean } | null)?.requested ? 'Hay kiem tra email de xac thuc tai khoan.' : '');
  const [error, setError] = useState('');
  useEffect(() => {
    const token = params.get('token');
    if (!token) return;
    verifyEmail(token).then(() => setMessage('Email da duoc xac thuc. Ban co the dang nhap.')).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Lien ket xac thuc khong hop le.'));
  }, [params]);
  return <main className="route-state auth-page"><section className="auth-form"><h1>Xac thuc email</h1>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}<p><Link to="/dang-nhap">Dang nhap</Link></p></section></main>;
};
