import { migrationStatus } from '../scripts/migrateDatabase.js';
import { sessionStoreDriver } from '../auth/session/sessionStore.js';

const configured = (value) => typeof value === 'string' && value.trim().length >= 24 && !/replace-with|changeme|example/i.test(value);

export const createCustomerAuthReadiness = ({
  env = process.env,
  pool,
  customerRepository,
  customerSessionRepository,
  sessionService,
  tokenDelivery,
} = {}) => ({
  async evaluate() {
    const mode = String(env.CUSTOMER_ACCOUNT_MODE ?? 'demo').toLowerCase();
    const blockers = [];
    if (!['demo', 'real'].includes(mode)) blockers.push('CUSTOMER_ACCOUNT_MODE_INVALID');
    if (env.NODE_ENV === 'production' && mode !== 'real') blockers.push('CUSTOMER_ACCOUNT_MODE_REAL_REQUIRED');
    if (mode !== 'real') blockers.push('CUSTOMER_AUTH_REAL_MODE_REQUIRED');
    if (mode === 'real') {
      if (sessionStoreDriver(env) !== 'postgres') blockers.push('CUSTOMER_SESSION_STORE_POSTGRES_REQUIRED');
      if (!pool) blockers.push('CUSTOMER_DATABASE_REQUIRED');
      if (!configured(env.CUSTOMER_SESSION_SECRET ?? env.SESSION_SECRET)) blockers.push('CUSTOMER_SESSION_KEY_REQUIRED');
      if (!configured(env.CUSTOMER_CSRF_SECRET ?? env.CSRF_SECRET)) blockers.push('CUSTOMER_CSRF_KEY_REQUIRED');
      const [database, sessions, schema] = await Promise.all([
        customerRepository?.health?.() ?? { status: 'unhealthy' },
        customerSessionRepository?.health?.() ?? { status: 'unhealthy' },
        pool ? migrationStatus({ pool }) : Promise.resolve({ status: 'unavailable', applied: [] }),
      ]);
      if (database.status !== 'healthy') blockers.push('CUSTOMER_DATABASE_UNHEALTHY');
      if (sessions.status !== 'healthy') blockers.push('CUSTOMER_SESSION_STORE_UNHEALTHY');
      if (schema.status !== 'current' || !schema.applied?.includes('006_customer_identity.sql')) blockers.push('CUSTOMER_MIGRATIONS_NOT_CURRENT');
      if (!sessionService?.keyRotation?.().active) blockers.push('CUSTOMER_KEY_RING_INVALID');
      if (env.NODE_ENV === 'production' && !tokenDelivery?.getHealth?.().configured) blockers.push('CUSTOMER_EMAIL_DELIVERY_REQUIRED');
    }

    return {
      status: blockers.length ? 'not_ready' : 'healthy',
      mode,
      database: !blockers.includes('CUSTOMER_DATABASE_REQUIRED') && !blockers.includes('CUSTOMER_DATABASE_UNHEALTHY'),
      sessionStore: !blockers.includes('CUSTOMER_SESSION_STORE_POSTGRES_REQUIRED') && !blockers.includes('CUSTOMER_SESSION_STORE_UNHEALTHY'),
      keyRing: !blockers.includes('CUSTOMER_SESSION_KEY_REQUIRED') && !blockers.includes('CUSTOMER_CSRF_KEY_REQUIRED') && !blockers.includes('CUSTOMER_KEY_RING_INVALID'),
      migrationsCurrent: !blockers.includes('CUSTOMER_MIGRATIONS_NOT_CURRENT'),
      emailDelivery: Boolean(tokenDelivery?.getHealth?.().configured),
      blockers,
    };
  },
});
