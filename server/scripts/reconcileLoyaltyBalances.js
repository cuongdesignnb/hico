import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { createLoyaltyLedgerRepository } from '../loyalty/loyaltyLedgerRepository.js';

export const reconcileLoyaltyBalances = async ({ pool, customerId = null } = {}) => {
  if (!pool) return { status: 'unavailable', reason: 'DATABASE_REQUIRED' };
  const report = await createLoyaltyLedgerRepository({ pool }).reconcile(customerId);
  return { status: report.mismatches.length ? 'fail' : 'pass', ...report };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = process.env.DATABASE_URL ? createPostgresPool() : null;
  try { process.stdout.write(`${JSON.stringify(await reconcileLoyaltyBalances({ pool }), null, 2)}\n`); }
  finally { await pool?.end(); }
}
