import crypto from 'node:crypto';
import {
  constantTimeSignatureEqual,
  createEsimOrderCallbackSignature,
  createEsimRedeemCallbackSignature,
  createRedeemCallbackSignature,
  createTopupCallbackSignature,
} from './worldmoveSignature.js';

export const WORLDMOVE_CALLBACK_TYPES = Object.freeze({
  ESIM_ORDER: 'ESIM_ORDER_CALLBACK',
  ESIM_ORDER_REDEEM: 'ESIM_ORDER_REDEEM_CALLBACK',
  REDEEM: 'REDEEM_CALLBACK',
  TOPUP: 'TOPUP_CALLBACK',
  ACTIVATION: 'ACTIVATION_NOTIFICATION',
});

const invalid = (message, code = 'WORLDMOVE_CALLBACK_INVALID') => Object.assign(new Error(message), { code, status: 400 });
const list = (value) => Array.isArray(value) ? value : [];
const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const detectWorldmoveCallbackType = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalid('Worldmove callback payload không hợp lệ.');
  const items = list(payload.itemList);
  const hasOrder = typeof payload.orderId === 'string' && payload.orderId.trim() !== '';
  if (hasOrder && has(payload, 'orderSN') && has(payload, 'orderTime') && (items.length === 0 || items.every((item) => has(item, 'redemptionCode'))) && (has(payload, 'code') || has(payload, 'msg'))) return WORLDMOVE_CALLBACK_TYPES.ESIM_ORDER;
  if (hasOrder && items.length > 0 && items.every((item) => has(item, 'wmproductId') && has(item, 'day') && has(item, 'simNum'))) return WORLDMOVE_CALLBACK_TYPES.TOPUP;
  if (hasOrder && items.length > 0 && items.every((item) => has(item, 'qrcode') || has(item, 'rcode'))) return WORLDMOVE_CALLBACK_TYPES.ESIM_ORDER_REDEEM;
  if (!hasOrder && has(payload, 'rcode') && has(payload, 'qrcode')) return WORLDMOVE_CALLBACK_TYPES.REDEEM;
  if (hasOrder && has(payload, 'rcode') && has(payload, 'iccid') && has(payload, 'useSDate') && has(payload, 'useEDate')) return WORLDMOVE_CALLBACK_TYPES.ACTIVATION;
  throw invalid('Worldmove callback shape không được hỗ trợ hoặc không rõ loại.');
};

const signatureFor = (payload, callbackType, merchantId, token) => {
  if (callbackType === WORLDMOVE_CALLBACK_TYPES.ESIM_ORDER) return createEsimOrderCallbackSignature({ merchantId, orderId: payload.orderId, orderSN: payload.orderSN, orderTime: payload.orderTime, itemList: payload.itemList, token });
  if (callbackType === WORLDMOVE_CALLBACK_TYPES.ESIM_ORDER_REDEEM) return createEsimRedeemCallbackSignature({ merchantId, orderId: payload.orderId, itemList: payload.itemList, token });
  if (callbackType === WORLDMOVE_CALLBACK_TYPES.TOPUP) return createTopupCallbackSignature({ merchantId, orderId: payload.orderId, itemList: payload.itemList, token });
  if (callbackType === WORLDMOVE_CALLBACK_TYPES.REDEEM) return createRedeemCallbackSignature({ merchantId, qrcode: payload.qrcode, rcode: payload.rcode, qrcodeType: payload.qrcodeType, token });
  return null;
};

export const verifyWorldmoveCallbackSignature = ({ payload, callbackType = detectWorldmoveCallbackType(payload), merchantId, token }) => {
  if (!merchantId || !token || !payload?.encStr) return { valid: false, code: 'WORLDMOVE_CALLBACK_SIGNATURE_INVALID' };
  if (callbackType === WORLDMOVE_CALLBACK_TYPES.ACTIVATION) return { valid: false, code: 'WORLDMOVE_ACTIVATION_CALLBACK_DISABLED' };
  const expected = signatureFor(payload, callbackType, merchantId, token);
  const valid = constantTimeSignatureEqual(expected, payload.encStr);
  return { valid, code: valid ? null : 'WORLDMOVE_CALLBACK_SIGNATURE_INVALID' };
};

const outcomeFor = (payload, callbackType) => {
  const items = list(payload.itemList);
  const itemOutcomes = items.map((item) => ({
    code: has(item, 'code') ? item.code : null,
    resultcode: has(item, 'resultcode') ? item.resultcode : has(item, 'resultCode') ? item.resultCode : null,
  }));
  if (callbackType === WORLDMOVE_CALLBACK_TYPES.ESIM_ORDER) {
    return { code: has(payload, 'code') ? payload.code : null, itemOutcomes };
  }
  if (callbackType === WORLDMOVE_CALLBACK_TYPES.TOPUP) return { itemOutcomes: itemOutcomes.map(({ code }) => ({ code })) };
  if (callbackType === WORLDMOVE_CALLBACK_TYPES.REDEEM) {
    return {
      code: has(payload, 'code') ? payload.code : null,
      resultcode: has(payload, 'resultcode') ? payload.resultcode : has(payload, 'resultCode') ? payload.resultCode : null,
    };
  }
  return { code: has(payload, 'code') ? payload.code : null, itemOutcomes };
};

const identityFor = (payload, callbackType) => JSON.stringify({
  callbackType,
  providerReference: payload.orderId ?? payload.rcode ?? null,
  orderSN: payload.orderSN ?? null,
  orderTime: payload.orderTime ?? null,
  // encStr is included only after the provider signature has been verified.
  // It captures signed business fields such as redemptionCode and qrcode.
  encStr: String(payload.encStr ?? '').trim().toUpperCase(),
  outcome: outcomeFor(payload, callbackType),
});

export const normalizeWorldmoveCallback = (payload, rawBody, { merchantId, token } = {}) => {
  const callbackType = detectWorldmoveCallbackType(payload);
  if (callbackType === WORLDMOVE_CALLBACK_TYPES.ACTIVATION) throw invalid('Worldmove activation callback đang bị vô hiệu hóa vì tài liệu chưa xác định cơ chế xác thực.', 'WORLDMOVE_ACTIVATION_CALLBACK_DISABLED');
  const verified = verifyWorldmoveCallbackSignature({ payload, callbackType, merchantId, token });
  if (!verified.valid) throw invalid('Worldmove callback signature không hợp lệ.', verified.code);
  const identity = identityFor(payload, callbackType);
  const eventId = `worldmove-${crypto.createHash('sha256').update(identity, 'utf8').digest('hex')}`;
  return {
    ...payload,
    eventId,
    eventType: callbackType,
    callbackType,
    providerOrderId: payload.orderId ?? payload.rcode,
    payloadHash: crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex'),
  };
};
