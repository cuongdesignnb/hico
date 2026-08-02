import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollRestoration = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const main = document.getElementById('main-content');
    main?.focus({ preventScroll: true });
  }, [location.pathname]);
  return null;
};
