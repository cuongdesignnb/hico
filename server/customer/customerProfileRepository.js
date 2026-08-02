import { randomUUID } from 'node:crypto';

const iso = (value) => value?.toISOString?.() ?? value ?? null;
const mapProfile = (row) => row ? ({
  customerId: row.customer_id,
  email: row.normalized_email,
  emailVerifiedAt: iso(row.email_verified_at),
  status: row.status,
  displayName: row.display_name,
  phone: row.normalized_phone,
  phoneVerifiedAt: iso(row.phone_verified_at),
  locale: row.locale,
  timezone: row.timezone,
  avatarUrl: row.avatar_url,
  createdAt: iso(row.profile_created_at ?? row.created_at),
  updatedAt: iso(row.profile_updated_at ?? row.updated_at),
}) : null;

const mapAddress = (row) => row ? ({
  id: row.id,
  customerId: row.customer_id,
  recipientName: row.recipient_name,
  phone: row.phone_snapshot,
  addressLine1: row.address_line1,
  addressLine2: row.address_line2,
  ward: row.ward,
  district: row.district,
  city: row.city,
  countryCode: row.country_code,
  postalCode: row.postal_code,
  isDefault: row.is_default,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
}) : null;

const mapContactChange = (row) => row ? ({
  id: row.id,
  customerId: row.customer_id,
  contactType: row.contact_type,
  newValueNormalized: row.new_value_normalized,
  status: row.status,
  expiresAt: iso(row.expires_at),
  consumedAt: iso(row.consumed_at),
  createdAt: iso(row.created_at),
  verifiedAt: iso(row.verified_at),
}) : null;

const profileSelect = `
  SELECT c.id AS customer_id, c.normalized_email, c.email_verified_at, c.status,
         p.display_name, p.normalized_phone, p.phone_verified_at, p.locale,
         p.timezone, p.avatar_url, p.created_at AS profile_created_at,
         p.updated_at AS profile_updated_at
  FROM customers c
  JOIN customer_profiles p ON p.customer_id = c.id
`;

export const createCustomerProfileRepository = ({ pool, now = () => new Date() } = {}) => {
  if (!pool) throw new Error('PostgreSQL pool is required for customer profiles.');
  const get = async (executor, customerId) => {
    const result = await executor.query(`${profileSelect} WHERE c.id = $1`, [customerId]);
    return mapProfile(result.rows[0]);
  };
  const address = async (executor, id, customerId) => {
    const result = await executor.query('SELECT * FROM customer_addresses WHERE id = $1 AND customer_id = $2', [id, customerId]);
    return mapAddress(result.rows[0]);
  };
  const withTransaction = async (callback) => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };

  return {
    getProfile(customerId) { return get(pool, customerId); },
    async updateProfile(customerId, updates) {
      const entries = Object.entries({
        displayName: 'display_name', locale: 'locale', timezone: 'timezone', avatarUrl: 'avatar_url',
      }).filter(([key]) => Object.hasOwn(updates, key));
      if (!entries.length) return get(pool, customerId);
      const values = entries.map(([key]) => updates[key]);
      const assignments = entries.map(([, column], index) => `${column} = $${index + 1}`).join(', ');
      values.push(now().toISOString(), customerId);
      const result = await pool.query(`UPDATE customer_profiles SET ${assignments}, updated_at = $${values.length - 1} WHERE customer_id = $${values.length} RETURNING customer_id`, values);
      if (!result.rowCount) return null;
      return get(pool, customerId);
    },
    async listAddresses(customerId) {
      const result = await pool.query('SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, updated_at DESC, id DESC', [customerId]);
      return result.rows.map(mapAddress);
    },
    async createAddress(customerId, input) {
      return withTransaction(async (client) => {
        await client.query('SELECT id FROM customers WHERE id = $1 FOR UPDATE', [customerId]);
        const count = await client.query('SELECT COUNT(*)::int AS count FROM customer_addresses WHERE customer_id = $1', [customerId]);
        if (Number(count.rows[0]?.count ?? 0) >= 20) throw Object.assign(new Error('Address limit reached.'), { code: 'ADDRESS_LIMIT_REACHED' });
        const id = randomUUID();
        const timestamp = now().toISOString();
        if (input.isDefault || Number(count.rows[0]?.count ?? 0) === 0) await client.query('UPDATE customer_addresses SET is_default = FALSE, updated_at = $2 WHERE customer_id = $1', [customerId, timestamp]);
        await client.query(`INSERT INTO customer_addresses
          (id, customer_id, recipient_name, phone_snapshot, address_line1, address_line2, ward, district, city, country_code, postal_code, is_default, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`, [id, customerId, input.recipientName, input.phone, input.addressLine1, input.addressLine2, input.ward, input.district, input.city, input.countryCode, input.postalCode, Boolean(input.isDefault) || Number(count.rows[0]?.count ?? 0) === 0, timestamp]);
        return address(client, id, customerId);
      });
    },
    async updateAddress(customerId, id, input) {
      return withTransaction(async (client) => {
        await client.query('SELECT id FROM customers WHERE id = $1 FOR UPDATE', [customerId]);
        const current = await address(client, id, customerId);
        if (!current) return null;
        const next = { ...current, ...input };
        if (next.isDefault) await client.query('UPDATE customer_addresses SET is_default = FALSE, updated_at = $3 WHERE customer_id = $1 AND id <> $2', [customerId, id, now().toISOString()]);
        await client.query(`UPDATE customer_addresses SET recipient_name=$3, phone_snapshot=$4, address_line1=$5, address_line2=$6, ward=$7, district=$8, city=$9, country_code=$10, postal_code=$11, is_default=$12, updated_at=$13 WHERE id=$1 AND customer_id=$2`, [id, customerId, next.recipientName, next.phone, next.addressLine1, next.addressLine2, next.ward, next.district, next.city, next.countryCode, next.postalCode, Boolean(next.isDefault), now().toISOString()]);
        return address(client, id, customerId);
      });
    },
    async setDefaultAddress(customerId, id) {
      return withTransaction(async (client) => {
        await client.query('SELECT id FROM customers WHERE id = $1 FOR UPDATE', [customerId]);
        const current = await address(client, id, customerId);
        if (!current) return null;
        const timestamp = now().toISOString();
        await client.query('UPDATE customer_addresses SET is_default = FALSE, updated_at = $2 WHERE customer_id = $1', [customerId, timestamp]);
        await client.query('UPDATE customer_addresses SET is_default = TRUE, updated_at = $3 WHERE id = $1 AND customer_id = $2', [id, customerId, timestamp]);
        return address(client, id, customerId);
      });
    },
    async deleteAddress(customerId, id) {
      return withTransaction(async (client) => {
        await client.query('SELECT id FROM customers WHERE id = $1 FOR UPDATE', [customerId]);
        const current = await address(client, id, customerId);
        if (!current) return null;
        await client.query('DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2', [id, customerId]);
        if (current.isDefault) {
          const next = await client.query('SELECT id FROM customer_addresses WHERE customer_id = $1 ORDER BY updated_at DESC, id DESC LIMIT 1', [customerId]);
          if (next.rowCount) await client.query('UPDATE customer_addresses SET is_default = TRUE, updated_at = $2 WHERE id = $1', [next.rows[0].id, now().toISOString()]);
        }
        return current;
      });
    },
    async createContactChange(change) {
      return withTransaction(async (client) => {
        await client.query("UPDATE customer_contact_changes SET status = 'CANCELLED' WHERE customer_id = $1 AND contact_type = $2 AND status = 'PENDING'", [change.customerId, change.contactType]);
        const result = await client.query(`INSERT INTO customer_contact_changes (id, customer_id, contact_type, new_value_normalized, token_hash, status, expires_at, consumed_at, created_at, verified_at)
          VALUES ($1,$2,$3,$4,$5,'PENDING',$6,NULL,$7,NULL) RETURNING *`, [change.id ?? randomUUID(), change.customerId, change.contactType, change.newValueNormalized, change.tokenHash, change.expiresAt, change.createdAt ?? now().toISOString()]);
        return mapContactChange(result.rows[0]);
      });
    },
    async getContactChangeByTokenHash(tokenHash) {
      const result = await pool.query('SELECT * FROM customer_contact_changes WHERE token_hash = $1', [tokenHash]);
      return mapContactChange(result.rows[0]);
    },
    async consumeContactChange(tokenHash, timestamp) {
      return withTransaction(async (client) => {
        const found = await client.query('SELECT * FROM customer_contact_changes WHERE token_hash = $1 FOR UPDATE', [tokenHash]);
        const row = found.rows[0];
        if (!row) return null;
        if (row.status !== 'PENDING') return { invalid: true, state: row.status };
        if (Date.parse(row.expires_at) <= Date.parse(timestamp)) {
          await client.query("UPDATE customer_contact_changes SET status = 'EXPIRED' WHERE id = $1", [row.id]);
          return { invalid: true, state: 'EXPIRED' };
        }
        if (row.contact_type === 'EMAIL') {
          const duplicate = await client.query('SELECT id FROM customers WHERE normalized_email = $1 AND id <> $2', [row.new_value_normalized, row.customer_id]);
          if (duplicate.rowCount) return { invalid: true, state: 'CONTACT_ALREADY_IN_USE' };
          await client.query('UPDATE customers SET normalized_email = $2, email_verified_at = $3, status = CASE WHEN status = \'pending_verification\' THEN \'active\' ELSE status END, updated_at = $3 WHERE id = $1', [row.customer_id, row.new_value_normalized, timestamp]);
        } else {
          await client.query('UPDATE customer_profiles SET normalized_phone = $2, phone_verified_at = $3, updated_at = $3 WHERE customer_id = $1', [row.customer_id, row.new_value_normalized, timestamp]);
        }
        await client.query("UPDATE customer_contact_changes SET status = 'CONSUMED', consumed_at = $2, verified_at = $2 WHERE id = $1", [row.id, timestamp]);
        return { customerId: row.customer_id, contactType: row.contact_type, value: row.new_value_normalized };
      });
    },
    async listSecurityEvents(customerId, { page = 1, pageSize = 30 } = {}) {
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
      const safeSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 30));
      const [rows, count] = await Promise.all([
        pool.query('SELECT id, event_type, request_id, created_at FROM customer_security_events WHERE customer_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3', [customerId, safeSize, (safePage - 1) * safeSize]),
        pool.query('SELECT COUNT(*)::int AS count FROM customer_security_events WHERE customer_id = $1', [customerId]),
      ]);
      const totalItems = Number(count.rows[0]?.count ?? 0);
      return { items: rows.rows.map((row) => ({ id: row.id, type: row.event_type, requestId: row.request_id, createdAt: iso(row.created_at) })), pagination: { page: safePage, pageSize: safeSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / safeSize)) } };
    },
    async health() {
      try { await pool.query('SELECT 1 FROM customer_profiles LIMIT 1'); await pool.query('SELECT 1 FROM support_tickets LIMIT 1'); return { status: 'healthy', persistence: 'postgres' }; }
      catch { return { status: 'unhealthy', persistence: 'postgres' }; }
    },
  };
};

export { mapProfile, mapAddress, mapContactChange };
