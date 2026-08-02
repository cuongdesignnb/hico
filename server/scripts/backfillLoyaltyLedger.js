import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { calculateEarnPoints, isEligibleItem, requiredMilestoneFor } from '../loyalty/loyaltyRules.js';

export const backfillLoyaltyLedger = async ({ pool, write = false } = {}) => {
  if (!pool) return { status: 'unavailable', dryRun: !write, reason: 'DATABASE_REQUIRED', scannedOrders: 0, eligibleItems: 0, points: 0, skipped: { guest: 0, unresolved: 0, cancelled: 0, invalidCurrency: 0, noRule: 0, zeroPoints: 0 }, written: 0 };
  const result = await pool.query("SELECT order_id, customer_id, ownership_status, status, currency, snapshot FROM orders ORDER BY created_at ASC");
  const report = { status: 'pass', dryRun: !write, scannedOrders: result.rowCount, eligibleItems: 0, points: 0, skipped: { guest: 0, unresolved: 0, cancelled: 0, invalidCurrency: 0, noRule: 0, zeroPoints: 0 }, written: 0 };
  for (const row of result.rows) {
    if (row.ownership_status !== 'OWNED' || !row.customer_id) { report.skipped[row.ownership_status === 'GUEST_UNCLAIMED' ? 'guest' : 'unresolved'] += 1; continue; }
    if (String(row.status).toUpperCase() === 'CANCELLED') { report.skipped.cancelled += 1; continue; }
    for (const [index, item] of (row.snapshot?.items ?? []).entries()) {
      const eligibility = isEligibleItem(item, row.currency);
      if (String(eligibility.currency).toUpperCase() !== 'VND') { report.skipped.invalidCurrency += 1; continue; }
      if (!requiredMilestoneFor(item)) { report.skipped.noRule += 1; continue; }
      if (!eligibility.eligible) { report.skipped.zeroPoints += 1; continue; }
      const points = calculateEarnPoints({ unitPrice: item.unitPrice ?? item.price, quantity: item.quantity, currency: eligibility.currency });
      report.eligibleItems += 1;
      report.points += points;
      if (write && String(process.env.LOYALTY_ENABLED).toLowerCase() !== 'true') throw Object.assign(new Error('LOYALTY_ENABLED=true is required for a write backfill.'), { code: 'LOYALTY_DISABLED' });
      // Writes are intentionally left to the event processor after milestone evidence is verified.
      if (write) report.written += 0;
      void index;
    }
  }
  return report;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write');
  const pool = process.env.DATABASE_URL ? createPostgresPool() : null;
  try { process.stdout.write(`${JSON.stringify(await backfillLoyaltyLedger({ pool, write }), null, 2)}\n`); }
  finally { await pool?.end(); }
}
