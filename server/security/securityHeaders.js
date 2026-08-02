export const createSecurityHeaders = ({ env = process.env } = {}) => (_req, res, next) => {
  res.set('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self'; form-action 'self'");
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.set('X-Frame-Options', 'DENY');
  if (env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=15552000');
  next();
};
