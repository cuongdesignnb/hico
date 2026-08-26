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
  createEsimRedeemCallbackSignature,
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
    code: 0,
    msg: 'success',
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

test('Worldmove order callback recognizes an explicit failed response without item data', () => {
  const payload = {
    orderId: 'WM-FAILED',
    orderSN: 'SN-FAILED',
    orderTime: '2026-08-26 10:00:00',
    code: 409,
    msg: 'failed',
    itemList: [],
  };
  payload.encStr = createEsimOrderCallbackSignature({ ...payload, merchantId, token });
  assert.equal(detectWorldmoveCallbackType(payload), WORLDMOVE_CALLBACK_TYPES.ESIM_ORDER);
  assert.equal(verifyWorldmoveCallbackSignature({ payload, merchantId, token }).valid, true);
});

test('Worldmove replay identity stays stable only for an exact signed retry', () => {
  const payload = {
    orderId: 'WM-RETRY',
    orderSN: 'SN-RETRY',
    orderTime: '2026-08-26 10:00:00',
    code: 0,
    itemList: [{ iccid: '8985204000012345678', productName: 'eSIM', redemptionCode: 'RC-RETRY' }],
  };
  payload.encStr = createEsimOrderCallbackSignature({ ...payload, merchantId, token });
  const first = normalizeWorldmoveCallback(payload, JSON.stringify(payload), { merchantId, token });
  const retry = normalizeWorldmoveCallback({ ...payload }, JSON.stringify(payload), { merchantId, token });
  assert.equal(first.eventId, retry.eventId);
});

test('Worldmove order replay identity changes when redemptionCode changes', () => {
  const base = {
    orderId: 'WM-ORDER-CODE', orderSN: 'SN-CODE', orderTime: '2026-08-26 10:00:00', code: 0,
    itemList: [{ iccid: '8985204000012345678', productName: 'eSIM', redemptionCode: 'RC-A' }],
  };
  const changed = { ...base, itemList: [{ ...base.itemList[0], redemptionCode: 'RC-B' }] };
  const signed = (payload) => ({ ...payload, encStr: createEsimOrderCallbackSignature({ ...payload, merchantId, token }) });
  const first = normalizeWorldmoveCallback(signed(base), JSON.stringify(signed(base)), { merchantId, token });
  const second = normalizeWorldmoveCallback(signed(changed), JSON.stringify(signed(changed)), { merchantId, token });
  assert.notEqual(first.eventId, second.eventId);
});

test('Worldmove replay identity separates redeem failure from later success', () => {
  const failed = { rcode: 'RC-RESULT', qrcodeType: 2, qrcode: 'qr-failed', resultcode: '409', resultmsg: 'failed' };
  const success = { ...failed, qrcode: 'qr-success', resultcode: '000', resultmsg: 'success' };
  const signed = (payload) => ({ ...payload, encStr: createRedeemCallbackSignature({ ...payload, merchantId, token }) });
  const first = normalizeWorldmoveCallback(signed(failed), JSON.stringify(signed(failed)), { merchantId, token });
  const second = normalizeWorldmoveCallback(signed(success), JSON.stringify(signed(success)), { merchantId, token });
  assert.notEqual(first.eventId, second.eventId);
});

test('Worldmove replay identity separates direct eSIM and top-up result changes', () => {
  const directFailed = { orderId: 'WM-DIRECT-RESULT', itemList: [{ iccid: '8985204000012345678', productName: 'eSIM', rcode: 'RC-DIRECT', qrcodeType: 2, qrcode: 'qr-value', resultcode: '409' }] };
  const directSuccess = { ...directFailed, itemList: [{ ...directFailed.itemList[0], resultcode: '000' }] };
  const signDirect = (payload) => ({ ...payload, encStr: createEsimRedeemCallbackSignature({ ...payload, merchantId, token }) });
  const directFirst = normalizeWorldmoveCallback(signDirect(directFailed), JSON.stringify(signDirect(directFailed)), { merchantId, token });
  const directSecond = normalizeWorldmoveCallback(signDirect(directSuccess), JSON.stringify(signDirect(directSuccess)), { merchantId, token });
  assert.notEqual(directFirst.eventId, directSecond.eventId);

  const topupFailed = { orderId: 'WM-TOPUP-RESULT', itemList: [{ wmproductId: 'WM', day: 7, simNum: '12345678901234567890', code: 500 }] };
  const topupSuccess = { ...topupFailed, itemList: [{ ...topupFailed.itemList[0], code: 1 }] };
  const signTopup = (payload) => ({ ...payload, encStr: createTopupCallbackSignature({ ...payload, merchantId, token }) });
  const topupFirst = normalizeWorldmoveCallback(signTopup(topupFailed), JSON.stringify(signTopup(topupFailed)), { merchantId, token });
  const topupSecond = normalizeWorldmoveCallback(signTopup(topupSuccess), JSON.stringify(signTopup(topupSuccess)), { merchantId, token });
  assert.notEqual(topupFirst.eventId, topupSecond.eventId);
});
