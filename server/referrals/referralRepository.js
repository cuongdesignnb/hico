import { randomUUID } from 'node:crypto';

const mapCode = (row) => row ? ({ id: row.id, code: row.code, status: row.status, createdAt: row.created_at?.toISOString?.() ?? row.created_at, updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at }) : null;
const mapRelationship = (row, customerId = null) => row ? ({
  id: row.id,
  role: customerId && row.referrer_customer_id === customerId ? 'REFERRER' : 'REFEREE',
  referrerCustomerId: row.referrer_customer_id,
  refereeCustomerId: row.referee_customer_id,
  referralCodeId: row.referral_code_id,
  code: row.code ?? null,
  status: row.status,
  source: row.source,
  createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  qualifiedAt: row.qualified_at?.toISOString?.() ?? row.qualified_at,
  reversedAt: row.reversed_at?.toISOString?.() ?? row.reversed_at,
}) : null;

const conflict = (code, message, status = 409) => Object.assign(new Error(message), { code, status });

export const createReferralRepository = ({ pool, now = () => new Date() } = {}) => {
  if (!pool) throw new Error('PostgreSQL pool is required for referrals.');
  const findCode = async (executor, code) => mapCode((await executor.query('SELECT * FROM referral_codes WHERE code = $1 AND status = \'ACTIVE\'', [code])).rows[0]);
  const insertEvent = (executor, event) => executor.query(
    'INSERT INTO referral_events (id, relationship_id, event_type, order_id, business_event_key, rule_id, rule_version, created_at, metadata_jsonb) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (business_event_key) DO NOTHING',
    [event.id ?? randomUUID(), event.relationshipId, event.eventType, event.orderId ?? null, event.businessEventKey, event.ruleId, event.ruleVersion, event.createdAt ?? now().toISOString(), JSON.stringify(event.metadata ?? {})],
  );

  return {
    async findActiveCode(customerId) { return mapCode((await pool.query("SELECT * FROM referral_codes WHERE customer_id = $1 AND status = 'ACTIVE'", [customerId])).rows[0]); },
    async createCode({ customerId, code }) {
      try {
        const result = await pool.query("INSERT INTO referral_codes (id, customer_id, code, status, created_at, updated_at) VALUES ($1,$2,$3,'ACTIVE',$4,$4) RETURNING *", [randomUUID(), customerId, code, now().toISOString()]);
        return mapCode(result.rows[0]);
      } catch (error) {
        if (error?.code !== '23505') throw error;
        const existing = await this.findActiveCode(customerId);
        if (existing) return existing;
        throw conflict('REFERRAL_CODE_CONFLICT', 'Referral code already exists.');
      }
    },
    async applyCode({ refereeCustomerId, code, source = 'CUSTOMER_CODE' } = {}) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const codeRow = await client.query(`SELECT rc.*, c.normalized_email AS referrer_email, c.status AS referrer_status, c.email_verified_at AS referrer_verified_at, p.normalized_phone AS referrer_phone FROM referral_codes rc JOIN customers c ON c.id = rc.customer_id LEFT JOIN customer_profiles p ON p.customer_id = c.id WHERE rc.code = $1 AND rc.status = 'ACTIVE' FOR UPDATE OF rc, c`, [code]);
        const referralCode = codeRow.rows[0];
        if (!referralCode || referralCode.referrer_status !== 'active' || !referralCode.referrer_verified_at) throw conflict('REFERRAL_CODE_INVALID', 'Referral code is invalid.', 400);
        const refereeResult = await client.query('SELECT c.id, c.normalized_email, c.email_verified_at, p.normalized_phone FROM customers c LEFT JOIN customer_profiles p ON p.customer_id = c.id WHERE c.id = $1 FOR UPDATE OF c', [refereeCustomerId]);
        const referee = refereeResult.rows[0];
        if (!referee) throw conflict('REFERRAL_CODE_INVALID', 'Customer account is unavailable.', 400);
        if (referralCode.customer_id === referee.id) throw conflict('REFERRAL_SELF_REFERRAL', 'Self referral is not allowed.');
        const existing = await client.query("SELECT * FROM referral_relationships WHERE referee_customer_id = $1 AND status IN ('PENDING','QUALIFIED','REWARDED','MANUAL_REVIEW') FOR UPDATE", [refereeCustomerId]);
        if (existing.rowCount) throw conflict('REFERRAL_ALREADY_APPLIED', 'A referral has already been applied.');
        const suspiciousReason = referee.email_verified_at && referralCode.referrer_email === referee.normalized_email
          ? 'same_verified_email'
          : referee.normalized_phone && referralCode.referrer_phone && referee.normalized_phone === referralCode.referrer_phone ? 'same_verified_phone' : null;
        const relationship = {
          id: randomUUID(), referrerCustomerId: referralCode.customer_id, refereeCustomerId,
          referralCodeId: referralCode.id, status: suspiciousReason ? 'MANUAL_REVIEW' : 'PENDING', source,
          createdAt: now().toISOString(), metadata: suspiciousReason ? { antiAbuseReason: suspiciousReason } : {},
        };
        await client.query('INSERT INTO referral_relationships (id, referrer_customer_id, referee_customer_id, referral_code_id, status, source, created_at, metadata_jsonb) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [relationship.id, relationship.referrerCustomerId, relationship.refereeCustomerId, relationship.referralCodeId, relationship.status, relationship.source, relationship.createdAt, JSON.stringify(relationship.metadata)]);
        await insertEvent(client, { relationshipId: relationship.id, eventType: 'REFERRAL_APPLIED', businessEventKey: `referral:${relationship.id}:applied`, ruleId: 'referral_attribution', ruleVersion: 'v1', createdAt: relationship.createdAt, metadata: relationship.metadata });
        await client.query('COMMIT');
        return { relationship: mapRelationship({ ...relationship, referrer_customer_id: relationship.referrerCustomerId, referee_customer_id: relationship.refereeCustomerId, referral_code_id: relationship.referralCodeId, created_at: relationship.createdAt, code: referralCode.code }), manualReview: Boolean(suspiciousReason) };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async listForCustomer(customerId, query = {}) {
      const values = [customerId];
      const clauses = ['(rr.referrer_customer_id = $1 OR rr.referee_customer_id = $1)'];
      if (query.status) { values.push(query.status); clauses.push(`rr.status = $${values.length}`); }
      const size = Math.min(50, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
      const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
      values.push(size, (page - 1) * size);
      const [rows, count] = await Promise.all([
        pool.query(`SELECT rr.*, rc.code FROM referral_relationships rr JOIN referral_codes rc ON rc.id = rr.referral_code_id WHERE ${clauses.join(' AND ')} ORDER BY rr.created_at DESC, rr.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values),
        pool.query(`SELECT COUNT(*)::int AS count FROM referral_relationships rr WHERE ${clauses.join(' AND ')}`, values.slice(0, query.status ? 2 : 1)),
      ]);
      const totalItems = Number(count.rows[0]?.count ?? 0);
      return { items: rows.rows.map((row) => mapRelationship(row, customerId)), pagination: { page, pageSize: size, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / size)) } };
    },
    async qualifyAndReward({ relationshipId, refereeCustomerId, orderId, ruleId, ruleVersion, rewardIssuer } = {}) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('SELECT rr.*, rc.code FROM referral_relationships rr JOIN referral_codes rc ON rc.id = rr.referral_code_id WHERE rr.id = $1 AND rr.referee_customer_id = $2 FOR UPDATE', [relationshipId, refereeCustomerId]);
        const relationship = result.rows[0];
        if (!relationship) return this._rollbackAndReturn(client, { skipped: true, reason: 'REFERRAL_NOT_ELIGIBLE' });
        if (relationship.status === 'REWARDED') return this._rollbackAndReturn(client, { skipped: true, reason: 'ALREADY_REWARDED', idempotent: true, relationship: mapRelationship(relationship) });
        if (relationship.status !== 'PENDING') return this._rollbackAndReturn(client, { skipped: true, reason: 'REFERRAL_NOT_ELIGIBLE', status: relationship.status });
        await insertEvent(client, { relationshipId, eventType: 'REFERRAL_QUALIFIED', orderId, businessEventKey: `referral:${relationshipId}:${orderId}:${ruleVersion}:qualified`, ruleId, ruleVersion });
        await client.query("UPDATE referral_relationships SET status = 'QUALIFIED', qualified_at = $2 WHERE id = $1", [relationshipId, now().toISOString()]);
        const rewards = await rewardIssuer({ client, relationship, orderId, ruleId, ruleVersion });
        if (!rewards?.length) {
          await client.query('COMMIT');
          return { skipped: false, qualified: true, rewarded: false, relationship: { ...mapRelationship(relationship), status: 'QUALIFIED' }, rewards: [] };
        }
        await client.query("UPDATE referral_relationships SET status = 'REWARDED' WHERE id = $1", [relationshipId]);
        await client.query('COMMIT');
        return { skipped: false, qualified: true, rewarded: true, relationship: { ...mapRelationship(relationship), status: 'REWARDED' }, rewards };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async _rollbackAndReturn(client, value) { await client.query('ROLLBACK'); return value; },
    async reverseRewards({ orderId, refereeCustomerId, ruleId, ruleVersion, reverseIssuer } = {}) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query("SELECT rr.*, rew.reward_side, rew.ledger_entry_id, rew.order_id AS reward_order_id FROM referral_relationships rr JOIN referral_rewards rew ON rew.relationship_id = rr.id WHERE rr.referee_customer_id = $1 AND rew.order_id = $2 AND rr.status = 'REWARDED' FOR UPDATE", [refereeCustomerId, orderId]);
        if (!result.rowCount) return this._rollbackAndReturn(client, { skipped: true, reason: 'REFERRAL_REWARD_NOT_FOUND' });
        const reversed = [];
        for (const reward of result.rows) reversed.push(await reverseIssuer({ client, reward, orderId, ruleId, ruleVersion }));
        await client.query("UPDATE referral_relationships SET status = 'REVERSED', reversed_at = $2 WHERE id = $1", [result.rows[0].id, now().toISOString()]);
        await insertEvent(client, { relationshipId: result.rows[0].id, eventType: 'REFERRAL_REVERSED', orderId, businessEventKey: `referral:${result.rows[0].id}:${orderId}:${ruleVersion}:reversed`, ruleId, ruleVersion });
        await client.query('COMMIT');
        return { skipped: false, reversed, relationshipId: result.rows[0].id, referrerCustomerId: result.rows[0].referrer_customer_id, refereeCustomerId: result.rows[0].referee_customer_id };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async createRewardReference(executor, { relationshipId, rewardSide, ledgerEntryId, orderId, ruleVersion }) {
      const result = await executor.query('INSERT INTO referral_rewards (id, relationship_id, reward_side, ledger_entry_id, order_id, rule_version, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (relationship_id, reward_side) DO NOTHING RETURNING *', [randomUUID(), relationshipId, rewardSide, ledgerEntryId, orderId, ruleVersion, now().toISOString()]);
      if (result.rowCount) return { idempotent: false, reward: result.rows[0] };
      const existing = await executor.query('SELECT * FROM referral_rewards WHERE relationship_id = $1 AND reward_side = $2', [relationshipId, rewardSide]);
      if (existing.rows[0]?.ledger_entry_id !== ledgerEntryId) throw conflict('REFERRAL_IDEMPOTENCY_CONFLICT', 'Referral reward key conflicts with another ledger entry.');
      return { idempotent: true, reward: existing.rows[0] };
    },
    async adminList(query = {}) {
      const size = Math.min(50, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
      const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
      const values = []; const clauses = [];
      if (query.relationshipId) { values.push(query.relationshipId); clauses.push(`id = $${values.length}`); }
      if (query.status) { values.push(query.status); clauses.push(`status = $${values.length}`); }
      values.push(size, (page - 1) * size);
      const [rows, count] = await Promise.all([
        pool.query(`SELECT * FROM referral_relationships ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values),
        pool.query(`SELECT COUNT(*)::int AS count FROM referral_relationships ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}`, values.slice(0, values.length - 2)),
      ]);
      const totalItems = Number(count.rows[0]?.count ?? 0);
      return { items: rows.rows.map((row) => mapRelationship(row)), pagination: { page, pageSize: size, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / size)) } };
    },
    async adminDecision({ relationshipId, status, reason, actorId }) {
      if (!['MANUAL_REVIEW', 'REJECTED'].includes(status)) throw conflict('REFERRAL_CODE_INVALID', 'Admin referral status is invalid.', 400);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('SELECT * FROM referral_relationships WHERE id = $1 FOR UPDATE', [relationshipId]);
        if (!result.rowCount) throw conflict('REFERRAL_NOT_ELIGIBLE', 'Referral relationship was not found.', 404);
        await client.query('UPDATE referral_relationships SET status = $2, metadata_jsonb = metadata_jsonb || $3::jsonb WHERE id = $1', [relationshipId, status, JSON.stringify({ adminReason: String(reason).slice(0, 240), adminActorId: actorId })]);
        await insertEvent(client, { relationshipId, eventType: `ADMIN_${status}`, businessEventKey: `referral:${relationshipId}:admin:${status}:${actorId}:${Date.now()}`, ruleId: 'admin_referral_review', ruleVersion: 'v1', metadata: { reason: String(reason).slice(0, 240) } });
        await client.query('COMMIT');
        return { status };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async health() { try { await pool.query('SELECT 1 FROM referral_codes LIMIT 1'); await pool.query('SELECT 1 FROM referral_relationships LIMIT 1'); return { status: 'healthy', persistence: 'postgres' }; } catch { return { status: 'unhealthy', persistence: 'postgres' }; } },
  };
};

export { mapCode, mapRelationship };
