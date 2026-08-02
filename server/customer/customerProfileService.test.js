import assert from 'node:assert/strict';
import test from 'node:test';
import { createCustomerProfileService } from './customerProfileService.js';

test('customer profile service allowlists mutable fields and fails closed for phone verification', async () => {
  const events = [];
  const repository = {
    async getProfile() { return { customerId: 'customer-1', email: 'one@example.test', emailVerifiedAt: new Date().toISOString(), displayName: 'One', phone: null, phoneVerifiedAt: null, locale: null, timezone: null, avatarUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; },
    async updateProfile(_customerId, updates) { return { ...(await this.getProfile()), ...updates }; },
  };
  const service = createCustomerProfileService({
    repository,
    customerRepository: { async findByEmail() { return null; }, async createSecurityEvent(event) { events.push(event); } },
    env: { CUSTOMER_PROFILE_ENABLED: 'true', CUSTOMER_TOKEN_SECRET: 'test-secret' },
    securityAudit: () => {},
  });
  const profile = await service.update('customer-1', { displayName: 'Updated' }, 'request-1');
  assert.equal(profile.displayName, 'Updated');
  assert.equal(events[0].eventType, 'SECURITY_PROFILE_CHANGED');
  await assert.rejects(() => service.requestContactChange({ customerId: 'customer-1', contactType: 'PHONE', value: '+84901234567' }), (error) => error.code === 'CONTACT_CHANGE_NOT_READY');
});

test('contact confirmation consumes the token and revokes other sessions', async () => {
  let sentToken = null;
  const repository = {
    async getProfile() { return { customerId: 'customer-1', email: 'one@example.test' }; },
    async createContactChange() {},
    async consumeContactChange() { return { customerId: 'customer-1', contactType: 'EMAIL', value: 'new@example.test' }; },
  };
  const service = createCustomerProfileService({
    repository,
    customerRepository: { async findByEmail() { return null; }, async createSecurityEvent() {} },
    customerSessionRepository: { async revokeOtherSessions(customerId, sessionId) { assert.equal(customerId, 'customer-1'); assert.equal(sessionId, ''); } },
    tokenDelivery: { async sendContactChange({ token }) { sentToken = token; } },
    notificationEventProcessor: { async emit(event) { assert.equal(event.type, 'SECURITY_PROFILE_CHANGED'); } },
    env: { CUSTOMER_PROFILE_ENABLED: 'true', CUSTOMER_TOKEN_SECRET: 'test-secret' },
  });
  await service.requestContactChange({ customerId: 'customer-1', contactType: 'EMAIL', value: 'new@example.test' });
  assert.ok(sentToken);
  assert.deepEqual(await service.confirmContactChange({ token: 'any-token' }), { confirmed: true });
});
