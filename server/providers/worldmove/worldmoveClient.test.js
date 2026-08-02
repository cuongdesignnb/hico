import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorldmoveClient,
  readWorldmoveConfig,
} from './worldmoveClient.js';
import { createQuotationSignature } from './worldmoveSignature.js';

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
