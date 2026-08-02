const mapSession = (row) => row ? {
  id: row.id,
  userId: row.user_id,
  tokenHash: row.token_hash,
  csrfTokenHash: row.csrf_hash,
  createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  lastSeenAt: row.last_seen_at?.toISOString?.() ?? row.last_seen_at,
  expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at,
  absoluteExpiresAt: row.absolute_expires_at?.toISOString?.() ?? row.absolute_expires_at,
  revokedAt: row.revoked_at?.toISOString?.() ?? row.revoked_at,
  revokeReason: row.revoke_reason,
  sessionVersion: row.session_version,
} : null;

export const createPostgresSessionStore = ({ pool } = {}) => {
  if (!pool) throw new Error('PostgreSQL pool is required.');
  const lookup = async (id) => mapSession((await pool.query('SELECT * FROM admin_sessions WHERE id = $1', [id])).rows[0]);
  return {
    async findByTokenHash(tokenHash) { return mapSession((await pool.query('SELECT * FROM admin_sessions WHERE token_hash = $1', [tokenHash])).rows[0]); },
    async create(session) {
      await pool.query('INSERT INTO admin_sessions (id, token_hash, user_id, csrf_hash, created_at, last_seen_at, expires_at, absolute_expires_at, revoked_at, revoke_reason, session_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [session.id, session.tokenHash, session.userId, session.csrfTokenHash, session.createdAt, session.lastSeenAt, session.expiresAt, session.absoluteExpiresAt, session.revokedAt, session.revokeReason ?? null, session.sessionVersion ?? 1]);
      return lookup(session.id);
    },
    async update(sessionId, update) {
      const allowed = { lastSeenAt: 'last_seen_at', expiresAt: 'expires_at', absoluteExpiresAt: 'absolute_expires_at', revokedAt: 'revoked_at', revokeReason: 'revoke_reason', csrfTokenHash: 'csrf_hash', sessionVersion: 'session_version' };
      const entries = Object.entries(update).filter(([key]) => key in allowed);
      if (!entries.length) return lookup(sessionId);
      const values = entries.map(([, value]) => value);
      const assignments = entries.map(([key], index) => `${allowed[key]} = $${index + 1}`).join(', ');
      const result = await pool.query(`UPDATE admin_sessions SET ${assignments} WHERE id = $${values.length + 1} RETURNING *`, [...values, sessionId]);
      return mapSession(result.rows[0]);
    },
    revokeById(sessionId, reason) { return this.update(sessionId, { revokedAt: new Date().toISOString(), revokeReason: reason }); },
    async revokeIfActive(sessionId, reason) {
      const result = await pool.query('UPDATE admin_sessions SET revoked_at = NOW(), revoke_reason = $2 WHERE id = $1 AND revoked_at IS NULL', [sessionId, reason]);
      return result.rowCount === 1;
    },
    async revokeByUserId(userId, reason) {
      await pool.query('UPDATE admin_sessions SET revoked_at = NOW(), revoke_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL', [userId, reason]);
    },
    async revokeAll(reason) {
      await pool.query('UPDATE admin_sessions SET revoked_at = NOW(), revoke_reason = $1 WHERE revoked_at IS NULL', [reason]);
    },
    async cleanup({ batchSize = 500, revokedRetentionHours = 24 * 30 } = {}) {
      const result = await pool.query('WITH candidates AS (SELECT id FROM admin_sessions WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - ($2::TEXT || \' hours\')::INTERVAL) ORDER BY expires_at NULLS FIRST LIMIT $1) DELETE FROM admin_sessions WHERE id IN (SELECT id FROM candidates)', [batchSize, revokedRetentionHours]);
      return result.rowCount;
    },
    async health() {
      try { await pool.query('SELECT 1 FROM admin_sessions LIMIT 1'); return { status: 'healthy', shared: true }; } catch { return { status: 'unhealthy', shared: true }; }
    },
  };
};
