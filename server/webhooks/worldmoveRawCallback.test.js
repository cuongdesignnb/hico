import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorldmoveRawCallbackSignature,
  parseWorldmoveRawCallback,
} from './worldmoveRawCallback.js';

const merchantId = 'b000024';
const token = 'worldmove-test-token';

const signed = (callbackType, payload) => {
  const signedPayload = { ...payload };
  signedPayload.encStr = createWorldmoveRawCallbackSignature({
    callbackType,
    payload: signedPayload,
    merchantId,
    token,
  });
  return signedPayload;
};

test('parses and verifies Worldmove 2.2 callback', () => {
  const payload = signed('ORDER_CALLBACK_2_2', {
    orderId: 'WM-22',
    orderSN: 'SN-22',
    orderTime: '2026-08-28 12:00:00',
    code: 0,
    itemList: [{ iccid: '89852001', productName: 'Japan eSIM', redemptionCode: 'RC-22' }],
  });
  const event = parseWorldmoveRawCallback({ payload, rawBody: JSON.stringify(payload), merchantId, token });

  assert.equal(event.eventType, 'ORDER_CALLBACK_2_2');
  assert.equal(event.providerOrderId, 'WM-22');
  assert.equal(event.redemptionCode, 'RC-22');
  assert.equal(event.providerSucceeded, true);
  assert.match(event.eventId, /^worldmove:ORDER_CALLBACK_2_2:/);
});

test('parses and verifies Worldmove 2.5 callback', () => {
  const payload = signed('ORDER_REDEEM_CALLBACK_2_5', {
    orderId: 'WM-25',
    itemList: [{
      iccid: '89852002',
      productName: 'Korea eSIM',
      rcode: 'RC-25',
      qrcodeType: 2,
      qrcode: 'https://example.test/qr-25',
      resultcode: '000',
      salePlanDays: 5,
    }],
  });
  const event = parseWorldmoveRawCallback({ payload, rawBody: JSON.stringify(payload), merchantId, token });

  assert.equal(event.eventType, 'ORDER_REDEEM_CALLBACK_2_5');
  assert.equal(event.providerOrderId, 'WM-25');
  assert.equal(event.redemptionCode, 'RC-25');
  assert.equal(event.salePlanDays, 5);
  assert.equal(event.providerSucceeded, true);
});

test('parses and verifies Worldmove 3.2 callback without order id', () => {
  const payload = signed('REDEEM_CALLBACK_3_2', {
    rcode: 'RC-32',
    qrcodeType: 2,
    qrcode: 'https://example.test/qr-32',
    resultcode: '000',
    salePlanDays: 7,
  });
  const lowerCasePayload = { ...payload, encStr: payload.encStr.toLowerCase() };
  const event = parseWorldmoveRawCallback({ payload: lowerCasePayload, rawBody: JSON.stringify(lowerCasePayload), merchantId, token });

  assert.equal(event.eventType, 'REDEEM_CALLBACK_3_2');
  assert.equal(event.providerOrderId, null);
  assert.equal(event.redemptionCode, 'RC-32');
  assert.equal(event.providerSucceeded, true);
  assert.equal(event.itemList[0].rcode, 'RC-32');
});

test('rejects a tampered encStr', () => {
  const payload = signed('REDEEM_CALLBACK_3_2', {
    rcode: 'RC-TAMPERED',
    qrcodeType: 2,
    qrcode: 'https://example.test/qr',
    resultcode: '000',
  });
  const tampered = { ...payload, qrcode: 'https://example.test/changed-qr' };

  assert.throws(
    () => parseWorldmoveRawCallback({ payload: tampered, rawBody: JSON.stringify(tampered), merchantId, token }),
    (error) => error.code === 'WORLDMOVE_RAW_SIGNATURE_INVALID' && error.status === 401,
  );
});

test('marks a valid provider failure without exposing the token', () => {
  const payload = signed('ORDER_CALLBACK_2_2', {
    orderId: 'WM-FAIL',
    orderSN: 'SN-FAIL',
    orderTime: '2026-08-28 12:00:00',
    code: 400,
    msg: 'failed',
    itemList: [{ iccid: '89852003', productName: 'Japan eSIM', redemptionCode: 'RC-FAIL' }],
  });
  const event = parseWorldmoveRawCallback({ payload, rawBody: JSON.stringify(payload), merchantId, token });

  assert.equal(event.providerSucceeded, false);
  assert.equal(JSON.stringify(event).includes(token), false);
});
