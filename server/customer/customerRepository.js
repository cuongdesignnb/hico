import { normalizeEmail } from '../auth/userRepository.js';

const mapCustomer = (row) => row ? {
  id: row.id,
  email: row.normalized_email,
  passwordHash: row.password_hash,
  status: row.status,
  emailVerifiedAt: row.email_verified_at?.toISOString?.() ?? row.email_verified_at,
  failedLoginCount: row.failed_login_count,
  lockedUntil: row.locked_until?.toISOString?.() ?? row.locked_until,
  passwordChangedAt: row.password_changed_at?.toISOString?.() ?? row.password_changed_at,
  credentialVersion: row.credential_version,
  createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  profile: row.display_name === undefined ? undefined : {
    displayName: row.display_name,
    phone: row.normalized_phone,
  },
} : null;

const customerColumns = `c.id, c.normalized_email, c.password_hash, c.status, c.email_verified_at,
  c.failed_login_count, c.locked_until, c.password_changed_at, c.credential_version,
  c.created_at, c.updated_at, p.display_name, p.normalized_phone`;
const customerFrom = ' FROM customers c LEFT JOIN customer_profiles p ON p.customer_id = c.id';

const selectCustomer = async (executor, where, values) => {
  const result = await executor.query(`SELECT ${customerColumns}${customerFrom} ${where}`, values);
  return mapCustomer(result.rows[0]);
};

export const createPostgresCustomerRepository = ({ pool } = {}) => {
  if (!pool) throw new Error('PostgreSQL pool is required for customer identity.');

  return {
    findByEmail(email) {
      return selectCustomer(pool, 'WHERE c.normalized_email = $1', [normalizeEmail(email)]);
    },
    findById(customerId) {
      return selectCustomer(pool, 'WHERE c.id = $1', [customerId]);
    },
    async create({ customer, profile }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'INSERT INTO customers (id, normalized_email, password_hash, status, email_verified_at, failed_login_count, locked_until, password_changed_at, credential_version, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [customer.id, normalizeEmail(customer.email), customer.passwordHash, customer.status, customer.emailVerifiedAt, customer.failedLoginCount ?? 0, customer.lockedUntil ?? null, customer.passwordChangedAt, customer.credentialVersion ?? 1, customer.createdAt, customer.updatedAt],
        );
        await client.query(
          'INSERT INTO customer_profiles (customer_id, display_name, normalized_phone, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)',
          [customer.id, profile.displayName, profile.phone ?? null, customer.createdAt, customer.updatedAt],
        );
        await client.query('COMMIT');
        return this.findById(customer.id);
      } catch (error) {
        await client.query('ROLLBACK');
        if (error?.code === '23505') throw Object.assign(new Error('Customer already exists.'), { code: 'CUSTOMER_ALREADY_EXISTS' });
        throw error;
      } finally {
        client.release();
      }
    },
    async update(customerId, update) {
      const allowed = {
        passwordHash: 'password_hash',
        status: 'status',
        emailVerifiedAt: 'email_verified_at',
        failedLoginCount: 'failed_login_count',
        lockedUntil: 'locked_until',
        passwordChangedAt: 'password_changed_at',
        credentialVersion: 'credential_version',
        updatedAt: 'updated_at',
      };
      const entries = Object.entries(update).filter(([key]) => key in allowed);
      if (!entries.length) return this.findById(customerId);
      const values = entries.map(([, value]) => value);
      const assignments = entries.map(([key], index) => `${allowed[key]} = $${index + 1}`).join(', ');
      const result = await pool.query(`UPDATE customers SET ${assignments} WHERE id = $${values.length + 1}`, [...values, customerId]);
      return result.rowCount ? this.findById(customerId) : null;
    },
    async createToken(table, token) {
      await pool.query(
        `INSERT INTO ${table} (id, customer_id, token_hash, expires_at, consumed_at, revoked_at, created_at) VALUES ($1,$2,$3,$4,NULL,NULL,$5)`,
        [token.id, token.customerId, token.tokenHash, token.expiresAt, token.createdAt],
      );
    },
    async consumeToken(table, tokenHash, now) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `UPDATE ${table} SET consumed_at = $1 WHERE token_hash = $2 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > $1 RETURNING customer_id`,
          [now, tokenHash],
        );
        await client.query('COMMIT');
        return result.rows[0]?.customer_id ?? null;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async tokenState(table, tokenHash, now) {
      const result = await pool.query(`SELECT expires_at, consumed_at, revoked_at FROM ${table} WHERE token_hash = $1`, [tokenHash]);
      const token = result.rows[0];
      if (!token) return 'missing';
      if (token.consumed_at || token.revoked_at) return 'consumed';
      return Date.parse(token.expires_at) <= Date.parse(now) ? 'expired' : 'active';
    },
    revokeActiveTokens(table, customerId) {
      return pool.query(`UPDATE ${table} SET revoked_at = NOW() WHERE customer_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`, [customerId]);
    },
    createSecurityEvent(event) {
      return pool.query(
        'INSERT INTO customer_security_events (id, customer_id, event_type, request_id, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [event.id, event.customerId ?? null, event.eventType, event.requestId ?? null, JSON.stringify(event.metadata ?? {}), event.createdAt],
      );
    },
    async health() {
      try {
        await pool.query('SELECT 1 FROM customers LIMIT 1');
        return { status: 'healthy', shared: true };
      } catch {
        return { status: 'unhealthy', shared: true };
      }
    },
  };
};
