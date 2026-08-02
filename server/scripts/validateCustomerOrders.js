import { createPostgresPool } from '../database/postgresPool.js';

const pool = createPostgresPool();
try {
  const [counts, invalid, duplicateEvents] = await Promise.all([
    pool.query('SELECT ownership_status, COUNT(*)::int AS count FROM orders GROUP BY ownership_status ORDER BY ownership_status'),
    pool.query("SELECT COUNT(*)::int AS count FROM orders WHERE (ownership_status='OWNED' AND customer_id IS NULL) OR (ownership_status<>'OWNED' AND customer_id IS NOT NULL) OR ownership_status NOT IN ('OWNED','GUEST_UNCLAIMED','LEGACY_UNRESOLVED','MANUAL_REVIEW')"),
    pool.query("SELECT COUNT(*)::int AS count FROM (SELECT order_id FROM order_ownership_events WHERE action='GUEST_CLAIM_CONFIRMED' GROUP BY order_id HAVING COUNT(*) > 1) duplicate_events"),
  ]);
  const ownership = Object.fromEntries(counts.rows.map((row) => [row.ownership_status, row.count]));
  const result = { status: invalid.rows[0].count || duplicateEvents.rows[0].count ? 'invalid' : 'healthy', totalOrders: Object.values(ownership).reduce((sum, count) => sum + count, 0), owned: ownership.OWNED ?? 0, guestUnclaimed: ownership.GUEST_UNCLAIMED ?? 0, legacyUnresolved: ownership.LEGACY_UNRESOLVED ?? 0, manualReview: ownership.MANUAL_REVIEW ?? 0, conflicts: invalid.rows[0].count + duplicateEvents.rows[0].count };
  console.log(JSON.stringify(result));
  if (result.status !== 'healthy') process.exitCode = 1;
} finally { await pool.end(); }
