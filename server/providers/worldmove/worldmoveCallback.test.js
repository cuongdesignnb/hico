import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectWorldmoveCallbackType,
  normalizeWorldmoveCallback,
  verifyWorldmoveCallbackSignature,
  WORLDMOVE_CALLBACK_TYPES,
} from './worldmoveCallback.js';
import {
  createEsimOrderCallbackSignature,
  createRedeemCallbackSignature,
  createTopupCallbackSignature,
} from './worldmoveSignature.js';

const merchantId = 'M';
const token = 'T';

test('Worldmove callback verification is type-specific and replay-stable', () => {
  const orderPayload = {
    orderId: 'WM-ORDER',
    orderSN: 'SN-1',
    orderTime: '2026-08-26 10:00:00',
    itemList: [{ iccid: '8985204000012345678', productName: 'eSIM', redemptionCode: 'RC-1' }],
  };
  orderPayload.encStr = createEsimOrderCallbackSignature({ ...orderPayload, merchantId, token });
  assert.equal(detectWorldmoveCallbackType(orderPayload), WORLDMOVE_CALLBACK_TYPES.ESIM_ORDER);
  assert.equal(verifyWorldmoveCallbackSignature({ payload: orderPayload, merchantId, token }).valid, true);
  const event = normalizeWorldmoveCallback(orderPayload, JSON.stringify(orderPayload), { merchantId, token });
  assert.equal(event.callbackType, WORLDMOVE_CALLBACK_TYPES.ESIM_ORDER);
  assert.match(event.eventId, /^worldmove-/);
  assert.equal(verifyWorldmoveCallbackSignature({ payload: { ...orderPayload, orderSN: 'changed' }, merchantId, token }).valid, false);
});

test('Worldmove top-up callback accepts item code 1 and rejects altered payloads', () => {
  const payload = { orderId: 'WM-TOPUP', itemList: [{ wmproductId: 'WM', day: 7, simNum: '12345678901234567890', code: 1, msg: 'success' }] };
  payload.encStr = createTopupCallbackSignature({ ...payload, merchantId, token });
  assert.equal(detectWorldmoveCallbackType(payload), WORLDMOVE_CALLBACK_TYPES.TOPUP);
  assert.equal(normalizeWorldmoveCallback(payload, JSON.stringify(payload), { merchantId, token }).eventType, WORLDMOVE_CALLBACK_TYPES.TOPUP);
  const altered = { ...payload, itemList: [{ ...payload.itemList[0], day: 8 }] };
  assert.equal(verifyWorldmoveCallbackSignature({ payload: altered, merchantId, token }).valid, false);
});

test('Worldmove redeem callback uses the documented root payload and activation stays disabled', () => {
  const payload = { rcode: 'RC-1', qrcodeType: 2, qrcode: 'https://provider.test/qr.png' };
  payload.encStr = createRedeemCallbackSignature({ ...payload, merchantId, token });
  assert.equal(detectWorldmoveCallbackType(payload), WORLDMOVE_CALLBACK_TYPES.REDEEM);
  assert.equal(normalizeWorldmoveCallback(payload, JSON.stringify(payload), { merchantId, token }).eventType, WORLDMOVE_CALLBACK_TYPES.REDEEM);
  const activation = { orderId: 'WM-ORDER', rcode: 'RC-1', iccid: '8985', useSDate: '1', useEDate: '2' };
  assert.throws(() => normalizeWorldmoveCallback(activation, JSON.stringify(activation), { merchantId, token }), (error) => error.code === 'WORLDMOVE_ACTIVATION_CALLBACK_DISABLED');
});
