import assert from 'node:assert/strict';
import test from 'node:test';
import { createCustomerNotificationService } from './customerNotificationService.js';
import { createNotificationEventProcessor } from './notificationEventProcessor.js';

const make = () => {
  const records = [];
  const repository = {
    async create(input) { const existing = records.find((item) => item.dedupeKey === input.dedupeKey); if (existing) return { notification: existing, idempotent: true }; const notification = { ...input, id: `notification-${records.length + 1}`, status: 'UNREAD' }; records.push(notification); return { notification, idempotent: false }; },
    async list() { return { items: records, pagination: { page: 1, pageSize: 20, totalItems: records.length, totalPages: 1 } }; },
    async unreadCount() { return records.filter((item) => item.status === 'UNREAD').length; },
    async markRead(id, customerId) { const item = records.find((entry) => entry.id === id && entry.customerId === customerId); if (item) item.status = 'READ'; return item ?? null; },
    async readAll() { records.forEach((item) => { item.status = 'READ'; }); return records.length; },
    async health() { return { status: 'healthy' }; },
  };
  return { service: createCustomerNotificationService({ repository, pool: {}, env: { CUSTOMER_NOTIFICATIONS_ENABLED: 'true' } }), processor: createNotificationEventProcessor({ notificationService: createCustomerNotificationService({ repository, pool: {}, env: { CUSTOMER_NOTIFICATIONS_ENABLED: 'true' } }) }), records };
};

test('notification events are deduplicated and never accept sensitive content', async () => {
  const { service, processor, records } = make();
  const first = await processor.emit({ customerId: 'customer-1', type: 'ORDER_STATUS_CHANGED', entityType: 'ORDER', entityId: 'order-1', eventVersion: 'v1', actionPath: '/tai-khoan/don-hang/order-1' });
  const retry = await processor.emit({ customerId: 'customer-1', type: 'ORDER_STATUS_CHANGED', entityType: 'ORDER', entityId: 'order-1', eventVersion: 'v1', actionPath: '/tai-khoan/don-hang/order-1' });
  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(records.length, 1);
  await assert.rejects(() => service.create({ customerId: 'customer-1', type: 'SECURITY_EVENT', title: 'Secret', message: 'LPA:private' }), (error) => error.code === 'INVALID_NOTIFICATION_FILTER');
});

test('notification actions stay owner scoped and read operations are idempotent', async () => {
  const { service, records } = make();
  const created = await service.create({ customerId: 'customer-1', type: 'ORDER_CREATED', title: 'Order', message: 'Order received', dedupeKey: 'order:1' });
  assert.equal((await service.unreadCount('customer-1')).unreadCount, 1);
  await assert.rejects(() => service.markRead(created.notification.id, 'customer-2'), (error) => error.code === 'NOTIFICATION_NOT_OWNED');
  await service.markRead(created.notification.id, 'customer-1');
  await service.readAll('customer-1');
  assert.equal(records[0].status, 'READ');
});
