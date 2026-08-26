import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorldmoveClient,
  readWorldmoveConfig,
} from './worldmoveClient.js';
import { createEsimOrderAndRedeemSignature, createEsimOrderSignature, createQuotationSignature, createRedeemSignature, createTopupSignature } from './worldmoveSignature.js';

test('quotation client sends the documented URL, signature, and timeout', async () => {
  const calls = [];
  const httpClient = {
    async post(...args) {
      calls.push(args);
      return { data: { code: 0, msg: 'Success', prodList: [] } };
    },
  };
  const client = createWorldmoveClient({
    merchantId: 'merchant-1',
    token: 'token-1',
    apiUrl: 'http://localhost:4000',
    httpClient,
    timeoutMs: 5000,
  });

  await client.fetchQuotation();

  assert.equal(calls[0][0], 'http://localhost:4000/Api/QuoteMg/myQueryAll');
  assert.equal(
    calls[0][1].encStr,
    createQuotationSignature('merchant-1', 'token-1'),
  );
  assert.equal(calls[0][2].timeout, 5000);
  assert.equal(JSON.stringify(calls[0]).includes('token-1'), false);
});

test('Worldmove configuration requires every secret environment value', () => {
  assert.throws(
    () => readWorldmoveConfig({
      WORLDMOVE_MERCHANT_ID: 'merchant-1',
      WORLDMOVE_API_URL: 'http://localhost:4000',
    }),
    /WORLDMOVE_DEPT_ID|WORLDMOVE_TOKEN/,
  );
});

test('Worldmove order, direct redeem, and top-up payloads follow v2.0.1 signatures', async () => {
  const calls = [];
  const httpClient = { async post(...args) { calls.push(args); return { data: { code: 0, orderId: 'WM-ORDER' } }; } };
  const client = createWorldmoveClient({ merchantId: 'M', deptId: 'D', token: 'T', apiUrl: 'http://localhost:4000', httpClient });

  await client.createEsimOrder({ email: 'customer@example.com', wmproductId: 'WM-ESIM', quantity: 1, idempotencyKey: 'i-1' });
  assert.equal(calls[0][0], 'http://localhost:4000/Api/SOrder/mybuyesim');
  assert.deepEqual(calls[0][1], { merchantId: 'M', deptId: 'D', email: 'customer@example.com', prodList: [{ wmproductId: 'WM-ESIM', qty: 1 }], systemMail: false, encStr: createEsimOrderSignature({ merchantId: 'M', deptId: 'D', email: 'customer@example.com', prodList: [{ wmproductId: 'WM-ESIM', qty: 1 }], token: 'T' }) });
  assert.equal(calls[0][1].systemMail, false);

  await client.createEsimOrderAndRedeem({ wmproductId: 'WM-ESIM', quantity: 1, idempotencyKey: 'i-2' });
  assert.equal(calls[1][0], 'http://localhost:4000/Api/SOrder/mybuyesimRedemption');
  assert.deepEqual(calls[1][1], { merchantId: 'M', deptId: 'D', qrcodeType: 2, prodList: [{ wmproductId: 'WM-ESIM', qty: 1 }], encStr: createEsimOrderAndRedeemSignature({ merchantId: 'M', deptId: 'D', qrcodeType: 2, prodList: [{ wmproductId: 'WM-ESIM', qty: 1 }], token: 'T' }) });
  assert.equal('email' in calls[1][1], false);

  await client.redeem({ rcode: 'RCODE', idempotencyKey: 'i-3' });
  assert.deepEqual(calls[2][1], { merchantId: 'M', rcode: 'RCODE', qrcodeType: 2, encStr: createRedeemSignature({ merchantId: 'M', rcode: 'RCODE', qrcodeType: 2, token: 'T' }) });

  await client.topup({ wmproductId: 'WM-TOPUP', simNum: '12345678901234567890', day: 7, idempotencyKey: 'i-4' });
  assert.equal(calls[3][0], 'http://localhost:4000/Api/SOrder/mydeposit');
  assert.deepEqual(calls[3][1], { merchantId: 'M', deptId: 'D', prodList: [{ wmproductId: 'WM-TOPUP', day: 7, simNum: '12345678901234567890' }], encStr: createTopupSignature({ merchantId: 'M', deptId: 'D', prodList: [{ wmproductId: 'WM-TOPUP', day: 7, simNum: '12345678901234567890' }], token: 'T' }) });
  assert.equal('email' in calls[3][1], false);
  assert.equal(calls.some((call) => Object.prototype.hasOwnProperty.call(call[1], 'token')), false);
});

test('Worldmove client rejects invalid SIM numbers and days over 30', async () => {
  const client = createWorldmoveClient({ merchantId: 'M', deptId: 'D', token: 'T', apiUrl: 'http://localhost:4000', httpClient: { post: async () => ({ data: { code: 0 } }) } });
  await assert.rejects(() => client.topup({ wmproductId: 'WM', simNum: '123', day: 1 }), (error) => error.code === 'SIM_NUMBER_INVALID');
  await assert.rejects(() => client.topup({ wmproductId: 'WM', simNum: '12345678901234567890', day: 31 }), (error) => error.code === 'TOPUP_DAYS_EXCEEDED');
});
