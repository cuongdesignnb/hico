const configured = (value) => typeof value === 'string' && value.trim().length >= 24 && !/replace-with|changeme|example/i.test(value);

export const validateProductionSecurity = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return { status: 'healthy', production: false, blockers: [] };
  const blockers = [];
  try {
    const origin = new URL(env.PUBLIC_SITE_URL);
    if (origin.protocol !== 'https:') blockers.push('PUBLIC_SITE_URL_HTTPS_REQUIRED');
  } catch { blockers.push('PUBLIC_SITE_URL_REQUIRED'); }
  if (!configured(env.SESSION_SECRET)) blockers.push('SESSION_SECRET_REQUIRED');
  if (!configured(env.CSRF_SECRET)) blockers.push('CSRF_SECRET_REQUIRED');
  if (!String(env.CORS_ALLOWED_ORIGINS ?? '').split(',').map((item) => item.trim()).filter(Boolean).length) blockers.push('CORS_ALLOWED_ORIGINS_REQUIRED');
  if (String(env.CORS_ALLOWED_ORIGINS ?? '').includes('*')) blockers.push('CORS_WILDCARD_FORBIDDEN');
  if (!configured(env.WORLDMOVE_WEBHOOK_SECRET)) blockers.push('WORLDMOVE_WEBHOOK_SECRET_REQUIRED');
  if (env.ADMIN_BOOTSTRAP_PASSWORD) blockers.push('BOOTSTRAP_PASSWORD_FORBIDDEN');
  if (String(env.SESSION_STORE_DRIVER ?? env.AUTH_STORE ?? '').toLowerCase() !== 'postgres') blockers.push('AUTH_SHARED_STORE_REQUIRED');
  return { status: blockers.length ? 'not_ready' : 'healthy', production: true, blockers };
};
