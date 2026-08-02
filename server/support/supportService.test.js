import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupportService } from './supportService.js';

const ticket = { id: 'ticket-1', customerId: 'customer-1', subject: 'Help', category: 'ACCOUNT', status: 'OPEN', priority: 'NORMAL', updatedAt: '2026-08-02T00:00:00.000Z' };

test('support rejects a link that is not owned by the current customer', async () => {
  const service = createSupportService({
    repository: { async createTicket() {}, async getForCustomer() { return null; } },
    orderRepository: { async getForCustomer() { return null; } },
    env: { CUSTOMER_SUPPORT_ENABLED: 'true' },
  });
  await assert.rejects(() => service.createCustomerTicket('customer-1', { subject: 'Order help', category: 'ORDER', body: 'Please help', orderId: 'other-order' }), (error) => error.code === 'SUPPORT_TICKET_NOT_FOUND');
});

test('support admin status changes require a reason and emit the customer-safe update', async () => {
  const events = [];
  const service = createSupportService({
    repository: {
      async getForAdmin() { return { ticket }; },
      async adminUpdate() { return { ...ticket, status: 'IN_PROGRESS', updatedAt: '2026-08-02T00:01:00.000Z' }; },
    },
    notificationEventProcessor: { async emit(event) { events.push(event); } },
    env: { CUSTOMER_SUPPORT_ENABLED: 'true' },
  });
  await assert.rejects(() => service.adminUpdate('ticket-1', { status: 'IN_PROGRESS' }, 'admin-1', 'request-1'), (error) => error.code === 'SUPPORT_TICKET_NOT_FOUND');
  const result = await service.adminUpdate('ticket-1', { status: 'IN_PROGRESS', reason: 'Assigned to support' }, 'admin-1', 'request-2');
  assert.equal(result.status, 'IN_PROGRESS');
  assert.equal(events[0].type, 'SUPPORT_STATUS_CHANGED');
});
