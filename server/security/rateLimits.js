const now = () => Date.now();

export const createRateLimiter = ({ windowMs, max, key = (req) => req.ip || req.socket.remoteAddress || 'unknown', audit = () => {} }) => {
  const buckets = new Map();
  return (req, res, next) => {
    const bucketKey = key(req);
    const current = buckets.get(bucketKey);
    const timestamp = now();
    const fresh = !current || current.resetAt <= timestamp;
    const bucket = fresh ? { count: 0, resetAt: timestamp + windowMs } : current;
    bucket.count += 1;
    buckets.set(bucketKey, bucket);
    if (bucket.count > max) {
      audit({ event: 'rate_limited', requestId: req.requestId, group: req.rateLimitGroup || 'default' });
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - timestamp) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' });
    }
    return next();
  };
};
