export const createRequestContextLogger = ({ logger, now = () => new Date() } = {}) => (req, res, next) => {
  const startedAt = now().getTime();
  res.on('finish', () => logger.info({
    event: 'http_request', requestId: req.requestId, actorId: req.auth?.user?.id,
    route: req.route?.path ?? req.baseUrl ?? req.path, method: req.method,
    status: res.statusCode, durationMs: now().getTime() - startedAt,
  }));
  next();
};
