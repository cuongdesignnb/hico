export const createCorsPolicy = ({ env = process.env } = {}) => {
  const configured = String(env.CORS_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
  const origins = configured.length ? configured : (env.NODE_ENV === 'production' ? [] : ['http://localhost:5173']);
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin) {
      if (!origins.includes(origin)) return res.status(403).json({ error: 'Origin is not allowed.', code: 'CORS_ORIGIN_DENIED' });
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Request-Id');
      res.set('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  };
};
