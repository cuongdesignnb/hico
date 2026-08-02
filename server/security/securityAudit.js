export const createSecurityAudit = ({ logger = console, onEvent = () => {} } = {}) => (event) => {
  const safe = Object.fromEntries(Object.entries(event).filter(([key]) => !/password|token|secret|cookie|authorization/i.test(key)));
  logger.info?.({ category: 'security', ...safe, timestamp: new Date().toISOString() });
  onEvent(safe);
};

export const createAdminRequestAudit = ({ securityAudit = () => {} } = {}) => (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  res.on('finish', () => {
    securityAudit({
      event: 'admin_write',
      requestId: req.requestId,
      actorId: req.auth?.user.id,
      actorEmail: req.auth?.user.email,
      sessionIdHash: req.auth?.sessionIdHash,
      permission: req.auth?.permissionUsed,
      method: req.method,
      path: req.originalUrl?.split('?')[0],
      statusCode: res.statusCode,
    });
  });
  return next();
};
