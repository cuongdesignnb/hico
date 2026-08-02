import pg from 'pg';

const { Pool } = pg;

const isTrue = (value) => String(value).toLowerCase() === 'true';

export const createPostgresPool = ({ env = process.env } = {}) => {
  if (!env.DATABASE_URL) throw Object.assign(new Error('DATABASE_URL is required for PostgreSQL auth.'), { code: 'DATABASE_URL_REQUIRED' });
  const sslRequired = isTrue(env.DATABASE_SSL) || (env.NODE_ENV === 'production' && !isTrue(env.DATABASE_SSL_DISABLE));
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: sslRequired ? { rejectUnauthorized: !isTrue(env.DATABASE_SSL_ALLOW_SELF_SIGNED) } : undefined,
    max: Math.max(1, Number.parseInt(env.DATABASE_POOL_MAX, 10) || 10),
    connectionTimeoutMillis: Math.max(100, Number.parseInt(env.DATABASE_CONNECT_TIMEOUT_MS, 10) || 5_000),
    idleTimeoutMillis: Math.max(1_000, Number.parseInt(env.DATABASE_IDLE_TIMEOUT_MS, 10) || 30_000),
  });
  // Idle client errors are reported by health/readiness checks; an unhandled
  // pool error event would otherwise terminate the backend during an outage.
  pool.on('error', () => {});
  return pool;
};

export const postgresHealth = async (pool) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'healthy' };
  } catch {
    return { status: 'unhealthy' };
  }
};
