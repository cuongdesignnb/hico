import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { createSePayCredentialService } from './sepayCredentialService.js';
import { createInMemorySePaySettingsRepository } from './sepaySettingsRepository.js';
import { hashBankAccount } from './sepaySettingsService.js';
import { createInMemorySePayPaymentRepository } from './sepayPaymentRepository.js';
import { createSePayWebhookService } from './sepayWebhookService.js';

const key = 'a'.repeat(64);
const timestamp = 1_753_000_000;
const credentialService = createSePayCredentialService({ env: { INTEGRATION_SETTINGS_ENCRYPTION_KEY: key } });

const payloadFor = (overrides = {}) => ({
  id: 'sepay-transaction-1',
  transferType: 'in',
  transferAmount: 10000,
  accountNumber: '123456',
  content: 'HICO-100',
  code: 'HICO-100',
  ...overrides,
});

const signed = (payload, secret = 'secret') => {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex')}`;
  return { rawBody, signature };
};

const createHarness = () => {
  const settingsRepository = createInMemorySePaySettingsRepository({ initial: {
    enabled: true,
    bankAccountHash: hashBankAccount('123456'),
    encryptedCredential: credentialService.encrypt('secret'),
  } });
  const paymentRepository = createInMemorySePayPaymentRepository({ orders: [{ orderId: 'HICO-100', order_id: 'HICO-100', currency: 'VND', subtotal: 10000 }] });
  return { service: createSePayWebhookService({ settingsRepository, credentialService, paymentRepository, now: () => timestamp * 1000, logger: { warn() {} } }), paymentRepository };
};

test('valid SePay payment is paid exactly once', async () => {
  const { service, paymentRepository } = createHarness();
  const firstPayload = payloadFor();
  const first = signed(firstPayload);
  assert.deepEqual(await service.handle({ ...first, timestamp: String(timestamp) }), { success: true });
  assert.deepEqual(await service.handle({ ...first, timestamp: String(timestamp) }), { success: true, idempotent: true });
  const order = await paymentRepository.findOrder('HICO-100');
  assert.equal(order.paymentStatus, 'PAID');
});

test('amount and reference mismatches are acknowledged for manual review', async () => {
  const { service } = createHarness();
  const amount = signed(payloadFor({ id: 'sepay-transaction-2', transferAmount: 9999 }));
  assert.deepEqual(await service.handle({ ...amount, timestamp: String(timestamp) }), { success: true, manualReview: true });
  const reference = signed(payloadFor({ id: 'sepay-transaction-3', content: 'UNKNOWN', code: 'UNKNOWN' }));
  assert.deepEqual(await service.handle({ ...reference, timestamp: String(timestamp) }), { success: true, manualReview: true });
});

test('invalid signature is rejected before persistence', async () => {
  const { service } = createHarness();
  const request = signed(payloadFor());
  await assert.rejects(() => service.handle({ ...request, signature: 'sha256=' + '0'.repeat(64), timestamp: String(timestamp) }), { code: 'SEPAY_SIGNATURE_INVALID' });
});

test('SePay secret is encrypted, masked, fingerprinted and reversible only with the key', () => {
  const secret = 'test-sepay-secret';
  const encrypted = credentialService.encrypt(secret);
  assert.equal(credentialService.decrypt(encrypted), secret);
  assert.equal(credentialService.mask(secret), '****cret');
  assert.match(credentialService.fingerprint(secret), /^sha256:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(encrypted).includes(secret), false);
});

test('settings repository rejects stale optimistic versions', async () => {
  const repository = createInMemorySePaySettingsRepository();
  const current = await repository.getSettings();
  await repository.saveSettings({ expectedVersion: current.version, changes: { enabled: true } });
  await assert.rejects(
    () => repository.saveSettings({ expectedVersion: current.version, changes: { enabled: false } }),
    { code: 'SETTINGS_VERSION_CONFLICT' },
  );
});
