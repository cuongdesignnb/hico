import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCustomerDashboardSummary, projectCustomerOrder } from './customerDashboardProjection.js';
import { parseDashboardQuery } from './customerDashboardValidation.js';

test('customer order projection allowlists safe fields and removes fulfillment secrets', () => {
  const order = projectCustomerOrder({
    orderId: '#SAFE-1', status: 'PROVISIONED', currency: 'VND', subtotal: 100000, createdAt: '2026-08-01T00:00:00.000Z',
    shipping: { recipientName: 'A Customer', phone: '0912345678', address: 'full address', city: 'Ha Noi' },
    items: [{ productName: 'Japan eSIM', productId: 'p1', variantId: 'v1', quantity: 1, unitPrice: 100000, currency: 'VND', iccid: '8985', redemptionCode: 'SECRET', qrcode: 'QR', qrcodeContent: 'LPA', pin1: '1234', puk1: '5678' }],
    providerResponse: { token: 'SECRET' }, audit: { actor: 'admin' },
  });
  assert.deepEqual(order.items[0], { productName: 'Japan eSIM', productId: 'p1', variantId: 'v1', sku: null, operation: null, quantity: 1, unitPrice: 100000, currency: 'VND' });
  assert.equal(order.shipping.phone, '********78');
  assert.equal('providerResponse' in order, false);
  assert.equal(JSON.stringify(order).includes('SECRET'), false);
  assert.equal(JSON.stringify(order).includes('8985'), false);
});

test('dashboard summary masks identity and calculates owner-scoped aggregates', () => {
  const summary = projectCustomerDashboardSummary({
    customer: { displayName: 'Customer', email: 'customer@example.com', phone: '0912345678' },
    orders: [{ orderId: '#1', status: 'PENDING', currency: 'VND', subtotal: 200000, items: [{ productName: 'eSIM', quantity: 2, unitPrice: 100000, currency: 'VND' }] }],
    totalItems: 3,
  });
  assert.equal(summary.customer.email, 'c*******@example.com');
  assert.equal(summary.customer.phone, '********78');
  assert.deepEqual(summary.orders, { total: 3, pending: 1, completed: 0, cancelled: 0, totalsByCurrency: { VND: 200000 } });
  assert.equal(summary.fulfillment.pendingItems, 2);
  assert.deepEqual(summary.capabilities, { assets: false, loyalty: false, notifications: false, referrals: false, support: false });
});

test('dashboard query parsing clamps pagination and accepts stable filters only', () => {
  assert.deepEqual(parseDashboardQuery({ page: '2', pageSize: '999', status: 'completed', sort: 'oldest', operation: 'esim' }), {
    page: 2, pageSize: 50, status: 'COMPLETED', operation: 'esim', sort: 'oldest', from: undefined, to: undefined,
  });
  assert.equal(parseDashboardQuery({ status: 'DROP TABLE', operation: 'unknown' }).status, undefined);
});

test('dashboard summary uses full owner aggregate rather than recent page counts', () => {
  const summary = projectCustomerDashboardSummary({
    customer: { displayName: 'Customer', email: 'customer@example.com' },
    orders: [{ orderId: '#recent', status: 'PENDING', items: [] }],
    aggregate: { total: 6, pending: 3, completed: 2, cancelled: 1, pendingItems: 7, totalsByCurrency: { VND: 900000 } },
  });
  assert.deepEqual(summary.orders, { total: 6, pending: 3, completed: 2, cancelled: 1, totalsByCurrency: { VND: 900000 } });
  assert.deepEqual(summary.fulfillment, { pendingOrders: 3, pendingItems: 7 });
});
