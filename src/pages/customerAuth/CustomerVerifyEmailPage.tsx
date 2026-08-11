import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../../services/customerAuthApi';
import { viAuth } from '../../i18n/vi/auth';

export const CustomerVerifyEmailPage = () => {
  const [params] = useSearchParams();
  const location = useLocation();
  const [message, setMessage] = useState((location.state as { requested?: boolean } | null)?.requested ? viAuth.verifyEmailSent : '');
  const [error, setError] = useState('');
  useEffect(() => {
    const token = params.get('token');
    if (!token) return;
    verifyEmail(token).then(() => setMessage(viAuth.verifyEmailSuccess)).catch((requestError) => setError(requestError instanceof Error ? requestError.message : viAuth.invalidVerificationLink));
  }, [params]);
  return <main className="route-state auth-page"><section className="auth-form"><h1>{viAuth.verifyEmail}</h1>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}<p><Link to="/dang-nhap">{viAuth.login}</Link></p></section></main>;
};
