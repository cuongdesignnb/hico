import { normalizeEmail } from '../userRepository.js';

const columns = 'u.id, u.email, u.display_name, u.password_hash, u.status, u.failed_login_count, u.locked_until, u.password_changed_at, u.credential_version, u.created_at, u.updated_at, COALESCE(array_agg(ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL), ARRAY[]::TEXT[]) AS roles';
const grouped = ' FROM admin_users u LEFT JOIN admin_user_roles ur ON ur.user_id = u.id';
const mapUser = (row) => row ? {
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  passwordHash: row.password_hash,
  status: row.status,
  failedLoginCount: row.failed_login_count,
  lockedUntil: row.locked_until?.toISOString?.() ?? row.locked_until,
  passwordChangedAt: row.password_changed_at?.toISOString?.() ?? row.password_changed_at,
  credentialVersion: row.credential_version,
  createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  roles: row.roles ?? [],
} : null;

const selectUser = async (executor, where, values) => {
  const result = await executor.query(`SELECT ${columns}${grouped} ${where} GROUP BY u.id`, values);
  return mapUser(result.rows[0]);
};

export const createPostgresAdminUserRepository = ({ pool } = {}) => {
  if (!pool) throw new Error('PostgreSQL pool is required.');
  const replaceRoles = async (client, userId, roles = []) => {
    await client.query('DELETE FROM admin_user_roles WHERE user_id = $1', [userId]);
    for (const role of [...new Set(roles)]) {
      const inserted = await client.query('INSERT INTO admin_user_roles (user_id, role_name) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING role_name', [userId, role]);
      if (!inserted.rowCount) {
        const exists = await client.query('SELECT 1 FROM admin_roles WHERE name = $1', [role]);
        if (!exists.rowCount) throw Object.assign(new Error('Unknown admin role.'), { code: 'ADMIN_ROLE_UNKNOWN' });
      }
    }
  };
  return {
    async list() {
      const result = await pool.query(`SELECT ${columns}${grouped} GROUP BY u.id ORDER BY u.created_at`);
      return result.rows.map(mapUser);
    },
    findByEmail(email) { return selectUser(pool, 'WHERE u.email = $1', [normalizeEmail(email)]); },
    findById(id) { return selectUser(pool, 'WHERE u.id = $1', [id]); },
    async create(user) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO admin_users (id, email, display_name, password_hash, status, failed_login_count, locked_until, password_changed_at, credential_version, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [user.id, normalizeEmail(user.email), user.displayName, user.passwordHash, user.status, user.failedLoginCount ?? 0, user.lockedUntil, user.passwordChangedAt, user.credentialVersion ?? 1, user.createdAt, user.updatedAt]);
        await replaceRoles(client, user.id, user.roles);
        await client.query('COMMIT');
        return this.findById(user.id);
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async createIfEmpty(user) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('hico_admin_bootstrap'))");
        const existing = await client.query('SELECT 1 FROM admin_users LIMIT 1');
        if (existing.rowCount) { await client.query('COMMIT'); return null; }
        await client.query('INSERT INTO admin_users (id, email, display_name, password_hash, status, failed_login_count, locked_until, password_changed_at, credential_version, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [user.id, normalizeEmail(user.email), user.displayName, user.passwordHash, user.status, user.failedLoginCount ?? 0, user.lockedUntil, user.passwordChangedAt, user.credentialVersion ?? 1, user.createdAt, user.updatedAt]);
        await replaceRoles(client, user.id, user.roles);
        await client.query('COMMIT');
        return this.findById(user.id);
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async update(userId, update) {
      const allowed = {
        displayName: 'display_name', passwordHash: 'password_hash', status: 'status', failedLoginCount: 'failed_login_count', lockedUntil: 'locked_until', passwordChangedAt: 'password_changed_at', credentialVersion: 'credential_version', updatedAt: 'updated_at',
      };
      const entries = Object.entries(update).filter(([key]) => key in allowed);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (entries.length) {
          const values = entries.map(([, value]) => value);
          const assignments = entries.map(([key], index) => `${allowed[key]} = $${index + 1}`).join(', ');
          const result = await client.query(`UPDATE admin_users SET ${assignments} WHERE id = $${values.length + 1}`, [...values, userId]);
          if (!result.rowCount) { await client.query('ROLLBACK'); return null; }
        }
        if (Array.isArray(update.roles)) await replaceRoles(client, userId, update.roles);
        await client.query('COMMIT');
        return this.findById(userId);
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async health() {
      try { await pool.query('SELECT 1 FROM admin_users LIMIT 1'); return { status: 'healthy', shared: true }; } catch { return { status: 'unhealthy', shared: true }; }
    },
  };
};
