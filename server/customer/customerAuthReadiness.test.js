import assert from 'node:assert/strict';
import test from 'node:test';

import { createCustomerAuthReadiness } from './customerAuthReadiness.js';

test('customer readiness fails closed for demo and invalid modes in production', async () => {
  const demo = await createCustomerAuthReadiness({
    env: { NODE_ENV: 'production', CUSTOMER_ACCOUNT_MODE: 'demo' },
  }).evaluate();
  assert.equal(demo.status, 'not_ready');
  assert.ok(demo.blockers.includes('CUSTOMER_ACCOUNT_MODE_REAL_REQUIRED'));

  const invalid = await createCustomerAuthReadiness({
    env: { NODE_ENV: 'production', CUSTOMER_ACCOUNT_MODE: 'unexpected' },
  }).evaluate();
  assert.equal(invalid.status, 'not_ready');
  assert.ok(invalid.blockers.includes('CUSTOMER_ACCOUNT_MODE_INVALID'));
});

test('customer readiness reports healthy only for real shared dependencies', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('schema_migrations')) return { rows: [
        { version: '001_admin_users.sql' },
        { version: '002_admin_roles_permissions.sql' },
        { version: '003_admin_sessions.sql' },
        { version: '004_auth_indexes.sql' },
        { version: '005_admin_permission_seed.sql' },
        { version: '006_customer_identity.sql' },
        { version: '007_order_ownership.sql' },
        { version: '008_customer_assets.sql' },
        { version: '009_loyalty_ledger.sql' },
        { version: '010_referral_notifications.sql' },
        { version: '011_customer_profile_security_support.sql' },
      ] };
      return { rows: [] };
    },
  };
  const ready = await createCustomerAuthReadiness({
    env: {
      NODE_ENV: 'production',
      CUSTOMER_ACCOUNT_MODE: 'real',
      SESSION_STORE_DRIVER: 'postgres',
      SESSION_SECRET: 'session-secret-for-customer-readiness-123456',
      CSRF_SECRET: 'csrf-secret-for-customer-readiness-123456789',
    },
    pool,
    customerRepository: { health: async () => ({ status: 'healthy', shared: true }) },
    customerSessionRepository: { health: async () => ({ status: 'healthy', shared: true }) },
    sessionService: { keyRotation: () => ({ active: true }) },
    tokenDelivery: { getHealth: () => ({ configured: true }) },
  }).evaluate();
  assert.equal(ready.status, 'healthy');
  assert.equal(ready.mode, 'real');
  assert.equal(ready.database, true);
  assert.equal(ready.sessionStore, true);
  assert.equal(ready.migrationsCurrent, true);
});
