import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { inventoryCustomerPlatform } from './inventoryCustomerPlatform.js';

const writeFixture = async (directory, fileName, value) => {
  await fs.writeFile(path.join(directory, fileName), JSON.stringify(value), 'utf8');
};

test('customer inventory is aggregate-only and classifies ownership without email linking', async (t) => {
  const uploadsDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'hico-customer-inventory-'));
  t.after(() => fs.rm(uploadsDirectory, { recursive: true, force: true }));

  await writeFixture(uploadsDirectory, 'orders.json', [
    { orderId: 'owned-order', customerId: 'customer-1', email: 'owner@example.test' },
    { orderId: 'guest-order', guestClaimStatus: 'UNCLAIMED', email: 'guest@example.test' },
    { orderId: 'review-order', requiresOwnershipReview: true, email: 'review@example.test' },
    { orderId: 'legacy-order', email: 'legacy@example.test' },
  ]);
  await writeFixture(uploadsDirectory, 'customers.json', [
    { email: 'legacy@example.test' },
    { email: 'other@example.test' },
  ]);
  await writeFixture(uploadsDirectory, 'esims.json', [
    { iccid: '8985000000000000000', qrcodeContent: 'LPA:1$private' },
  ]);
  await writeFixture(uploadsDirectory, 'manual_qrs.json', [
    { qrcodeContent: 'LPA:1$private-a' },
    { qrcodeContent: 'LPA:1$private-b' },
  ]);

  const report = await inventoryCustomerPlatform({
    uploadsDirectory,
    now: () => new Date('2026-08-02T00:00:00.000Z'),
    sourceContents: {
      'server/hicoBackend.js': [
        "app.get('/api/user/orders'",
        "app.get('/api/user/esim/:iccid'",
        "app.post('/api/user/topup'",
        'RC_JAPAN_MOCK',
      ].join('\n'),
      'server/checkout/checkoutRouter.js': [
        "router.get('/checkout/orders/:orderId'",
        "router.post('/checkout/orders/:orderId/retry-fulfillment'",
      ].join('\n'),
      'server/fulfillment/fulfillmentRouter.js': "router.get('/user/orders'",
      'src/components/UserDashboard/UserDashboard.tsx': 'qrcodeContent Math.max(2, cartItemCount)',
      'src/context/AppContext.tsx': "localStorage.getItem('hico_cart')",
      'src/routing/AppRouter.tsx': 'path="tai-khoan"',
      'src/pages/account/AccountLayout.tsx': 'CustomerProtectedRoute',
      'src/pages/account/AccountOverviewPage.tsx': '/api/customer/dashboard/summary',
      'src/pages/account/AccountOrdersPage.tsx': '/api/customer/orders',
      'src/pages/account/AccountOrderDetailPage.tsx': '/api/customer/orders',
      'src/services/customerDashboardApi.ts': '/api/customer/dashboard/summary',
      'src/services/customerOrdersApi.ts': '/api/customer/orders',
    },
  });

  assert.deepEqual(report.datasets.orders, { count: 4, state: 'present' });
  assert.deepEqual(report.datasets.fulfillments, { count: 0, state: 'missing' });
  assert.deepEqual(report.ownership, {
    OWNED: 1,
    GUEST_UNCLAIMED: 1,
    MANUAL_REVIEW: 1,
    LEGACY_UNRESOLVED: 1,
    autoLinkedByEmail: 0,
  });
  assert.deepEqual(
    report.unscopedEndpoints.map(({ code }) => code),
    [
      'LEGACY_USER_ORDERS_FULFILLMENT',
      'LEGACY_USER_ORDERS_DIRECT',
      'LEGACY_ESIM_BY_ICCID',
      'LEGACY_TOPUP_BY_ICCID',
      'PUBLIC_CHECKOUT_ORDER_LOOKUP',
      'PUBLIC_CHECKOUT_FULFILLMENT_RETRY',
    ],
  );
  assert.equal(report.browserStorage.keys[0], 'hico_cart');
  assert.deepEqual(report.browserStorage.authenticationKeys, []);

  const serialized = JSON.stringify(report);
  for (const secret of [
    'owner@example.test',
    'legacy@example.test',
    '8985000000000000000',
    'LPA:1$private',
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal(report.sensitiveDataPolicy.rawValuesIncluded, false);
  assert.deepEqual(report.productionSurface, {
    userDashboardRouteCount: 0,
    accountApiUserReferenceCount: 0,
    hardCodedSensitiveDataCount: 0,
    legacyMockFiles: 1,
    assetApiUserReferenceCount: 0,
    hardCodedAssetValueCount: 0,
    productionLoyaltySourceCount: 4,
    hardCodedPointsCount: 0,
    fakeCashEquivalentCount: 0,
    walletWordingCount: 0,
    localPointsBalanceCount: 0,
    legacyPointsApiReferenceCount: 0,
    directBalanceMutationCount: 0,
    hardCodedReferralAmountCount: 0,
    fakeUnreadCount: 0,
    fakeNotificationCount: 0,
    fakeReferralStatsCount: 0,
    directRewardBalanceMutationCount: 0,
    legacyNotificationApiReferenceCount: 0,
  });
});

test('customer inventory detects referral and notification demo patterns without returning source values', async (t) => {
  const uploadsDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'hico-customer-inventory-findings-'));
  t.after(() => fs.rm(uploadsDirectory, { recursive: true, force: true }));
  const report = await inventoryCustomerPlatform({
    uploadsDirectory,
    sourceContents: {
      'src/pages/account/AccountReferralsPage.tsx': 'HICOSON50 referralStats: 7;',
      'src/pages/account/AccountNotificationsPage.tsx': 'const notifications = []; unreadCount: 3; points += 1; /api/user/notifications',
    },
  });
  assert.equal(report.productionSurface.hardCodedReferralAmountCount, 1);
  assert.equal(report.productionSurface.fakeUnreadCount, 1);
  assert.equal(report.productionSurface.fakeNotificationCount, 1);
  assert.equal(report.productionSurface.fakeReferralStatsCount, 1);
  assert.equal(report.productionSurface.directRewardBalanceMutationCount, 1);
  assert.equal(report.productionSurface.legacyNotificationApiReferenceCount, 1);
  assert.deepEqual(report.demoFindings.map(({ code }) => code), ['MOCK_DASHBOARD_SENSITIVE_ASSET', 'MOCK_DASHBOARD_CART_COUNT', 'MOCK_ESIM_SEED', 'HARDCODED_REFERRAL_DEMO_CODE']);
  assert.equal(JSON.stringify(report).includes('HICOSON50'), false);
});
