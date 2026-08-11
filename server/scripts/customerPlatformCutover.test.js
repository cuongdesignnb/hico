import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMigrationReport } from './migrateCustomerPlatform.js';
import { verifyCustomerRealMode } from './verifyCustomerRealMode.js';
import { rollbackCustomerPlatformCutover } from './rollbackCustomerPlatformCutover.js';
import { createCustomerPlatformHealthService } from '../customer/customerPlatformHealthService.js';

const inventory = {
  datasets: { customerProfiles: { count: 2 }, esims: { count: 1 }, manualQrs: { count: 2 } },
  ownership: { OWNED: 0, GUEST_UNCLAIMED: 0, MANUAL_REVIEW: 0, LEGACY_UNRESOLVED: 5 },
  productionMockImports: 0,
};

test('customer migration report is safe, dry-run by default, and preserves unresolved ownership', () => {
  const report = createMigrationReport({
    inventory,
    env: { CUSTOMER_ACCOUNT_MODE: 'real', LOYALTY_ENABLED: 'false', REFERRAL_ENABLED: 'false', DATABASE_URL: 'configured' },
    migration: { status: 'current', applied: ['012_customer_platform_cutover.sql'] },
    quarantineCount: 10,
  });
  assert.equal(report.dryRun, true);
  assert.equal(report.ready, true);
  assert.equal(report.orders.legacyUnresolved, 5);
  assert.equal(report.quarantined, 10);
  assert.equal(JSON.stringify(report).includes('example'), false);
});

test('real-mode verifier blocks demo fallback and loyalty/referral activation', async () => {
  const result = await verifyCustomerRealMode({
    env: {
      CUSTOMER_ACCOUNT_MODE: 'demo',
      CUSTOMER_DEMO_FALLBACK_ENABLED: 'true',
      LEGACY_CUSTOMER_API_ENABLED: 'false',
      LOYALTY_ENABLED: 'true',
      REFERRAL_ENABLED: 'true',
      CUSTOMER_PROFILE_ENABLED: 'false',
      CUSTOMER_SUPPORT_ENABLED: 'false',
      CUSTOMER_ASSETS_ENABLED: 'false',
      CUSTOMER_NOTIFICATIONS_ENABLED: 'false',
    },
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.includes('CUSTOMER_ACCOUNT_MODE_REAL_REQUIRED'));
  assert.ok(result.blockers.includes('LOYALTY_MUST_REMAIN_DISABLED'));
  assert.ok(result.blockers.includes('REFERRAL_MUST_REMAIN_DISABLED'));
});

test('rollback report keeps real mode and never restores demo fallback', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hico-customer-rollback-'));
  try {
    const result = await rollbackCustomerPlatformCutover({ env: { CUSTOMER_ACCOUNT_MODE: 'real' }, outputPath: path.join(directory, 'rollback.json') });
    assert.equal(result.status, 'dry_run');
    assert.equal(result.customerMode, 'real');
    assert.equal(result.demoFallbackEnabled, false);
    assert.equal(result.legacyUserApiEnabled, false);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('customer platform health fails closed when database checks exceed the timeout', async () => {
  const never = { health: () => new Promise(() => {}) };
  const service = createCustomerPlatformHealthService({
    env: {
      CUSTOMER_ACCOUNT_MODE: 'real',
      CUSTOMER_DEMO_FALLBACK_ENABLED: 'false',
      LEGACY_CUSTOMER_API_ENABLED: 'false',
      CUSTOMER_PLATFORM_HEALTH_TIMEOUT_MS: '250',
    },
    pool: { query: () => new Promise(() => {}) },
    customerAuthReadiness: never,
    customerOrderRepository: never,
    customerDashboardService: never,
    customerAssetRepository: never,
    loyaltyService: never,
    referralService: never,
    customerNotificationService: never,
    customerProfileService: never,
    supportHealthService: never,
  });
  const startedAt = Date.now();
  const result = await service.health();
  assert.ok(Date.now() - startedAt < 1500);
  assert.equal(result.status, 'not_ready');
  assert.ok(result.blockers.includes('CUSTOMER_PLATFORM_MIGRATIONS_NOT_CURRENT'));
  assert.ok(result.blockers.includes('CUSTOMER_PLATFORM_QUARANTINE_UNHEALTHY'));
});
