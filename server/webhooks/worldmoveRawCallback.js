import crypto from 'node:crypto';

const text = (value) => (value === undefined || value === null ? '' : String(value));
const sha1Upper = (value) => crypto.createHash('sha1').update(text(value), 'utf8').digest('hex').toUpperCase();
const sha256 = (value) => crypto.createHash('sha256').update(text(value), 'utf8').digest('hex');

const firstItem = (payload) => (Array.isArray(payload?.itemList) ? payload.itemList[0] : payload?.item) ?? payload ?? {};
const itemList = (payload) => (Array.isArray(payload?.itemList) ? payload.itemList : payload?.item ? [payload.item] : [payload]);
const normalizeType = (value) => text(value).trim().toUpperCase().replace(/\s+/g, '_');

export class WorldmoveRawCallbackError extends Error {
  constructor(message, code = 'WORLDMOVE_RAW_CALLBACK_INVALID', status = 400) {
    super(message);
    this.name = 'WorldmoveRawCallbackError';
    this.code = code;
    this.status = status;
  }
}

const detectCallbackType = (payload) => {
  const explicit = normalizeType(payload.callbackType ?? payload.callbackTypeId ?? payload.eventType);
  if (/3[._-]?2|REDEEM_CALLBACK/.test(explicit) && !/2[._-]?5|ORDER_REDEEM/.test(explicit)) return 'REDEEM_CALLBACK_3_2';
  if (/2[._-]?5|ORDER_REDEEM|ESIM_ORDER_REDEEM/.test(explicit)) return 'ORDER_REDEEM_CALLBACK_2_5';
  if (/2[._-]?2|ORDER_CALLBACK|ESIM_ORDER_CALLBACK/.test(explicit)) return 'ORDER_CALLBACK_2_2';

  const item = firstItem(payload);
  if (payload.qrcode !== undefined && (payload.rcode !== undefined || payload.redemptionCode !== undefined)) return 'REDEEM_CALLBACK_3_2';
  if (payload.orderId && (item.qrcode !== undefined || item.rcode !== undefined || item.qrcodeType !== undefined)) return 'ORDER_REDEEM_CALLBACK_2_5';
  if (payload.orderId && (payload.orderSN !== undefined || payload.orderTime !== undefined || item.redemptionCode !== undefined)) return 'ORDER_CALLBACK_2_2';
  throw new WorldmoveRawCallbackError('Worldmove callback shape is invalid.');
};

const successCode = (value) => value === true
  || value === 0
  || ['0', '000', 'SUCCESS', 'SUCCEEDED', 'OK'].includes(text(value).trim().toUpperCase());

const providerSucceeded = (callbackType, payload) => {
  const item = firstItem(payload);
  const code = callbackType === 'ORDER_CALLBACK_2_2'
    ? payload.code
    : item.resultcode ?? item.code ?? payload.resultcode ?? payload.code;
  return code === undefined || code === null || successCode(code);
};

const callbackSignatureInput = (callbackType, payload, merchantId, token) => {
  const items = itemList(payload);
  if (callbackType === 'ORDER_CALLBACK_2_2') {
    const itemSum = items.map((item) => `${text(item.iccid)}${text(item.productName)}${text(item.redemptionCode ?? item.rcode)}`).join('');
    return `${text(merchantId)}${text(payload.orderId)}${text(payload.orderSN)}${text(payload.orderTime)}${itemSum}${text(token)}`;
  }
  if (callbackType === 'ORDER_REDEEM_CALLBACK_2_5') {
    const itemSum = items.map((item) => `${text(item.iccid)}${text(item.productName)}${text(item.rcode ?? item.redemptionCode)}${text(item.qrcodeType)}${text(item.qrcode)}`).join('');
    return `${text(merchantId)}${text(payload.orderId)}${itemSum}${text(token)}`;
  }
  const item = firstItem(payload);
  return `${text(merchantId)}${text(payload.qrcode ?? item.qrcode)}${text(payload.rcode ?? payload.redemptionCode ?? item.rcode ?? item.redemptionCode)}${text(payload.qrcodeType ?? item.qrcodeType)}${text(token)}`;
};

const constantTimeEqualIgnoreCase = (left, right) => {
  const a = Buffer.from(text(left).toUpperCase(), 'utf8');
  const b = Buffer.from(text(right).toUpperCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const createWorldmoveRawCallbackSignature = ({ callbackType, payload, merchantId, token }) => {
  const normalizedType = normalizeType(callbackType);
  const resolvedType = normalizedType.includes('2.2') || normalizedType.includes('2_2') || normalizedType.includes('ORDER_CALLBACK')
    ? 'ORDER_CALLBACK_2_2'
    : normalizedType.includes('2.5') || normalizedType.includes('2_5') || normalizedType.includes('ORDER_REDEEM')
      ? 'ORDER_REDEEM_CALLBACK_2_5'
      : 'REDEEM_CALLBACK_3_2';
  return sha1Upper(callbackSignatureInput(resolvedType, payload, merchantId, token));
};

export const parseWorldmoveRawCallback = ({ payload, rawBody = JSON.stringify(payload), merchantId, token } = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new WorldmoveRawCallbackError('Worldmove callback payload is invalid.');
  }
  if (!merchantId || !token || !payload.encStr) {
    throw new WorldmoveRawCallbackError('Worldmove callback signature is invalid.', 'WORLDMOVE_RAW_SIGNATURE_INVALID', 401);
  }

  const callbackType = detectCallbackType(payload);
  const expected = createWorldmoveRawCallbackSignature({ callbackType, payload, merchantId, token });
  if (!constantTimeEqualIgnoreCase(expected, payload.encStr)) {
    throw new WorldmoveRawCallbackError('Worldmove callback signature is invalid.', 'WORLDMOVE_RAW_SIGNATURE_INVALID', 401);
  }

  const item = firstItem(payload);
  const redemptionCode = text(payload.rcode ?? payload.redemptionCode ?? item.rcode ?? item.redemptionCode).trim() || null;
  const providerOrderId = text(payload.orderId).trim() || null;
  const body = text(rawBody);
  const payloadHash = sha256(body);
  return {
    ...payload,
    eventId: `worldmove:${callbackType}:${payloadHash}`,
    eventType: callbackType,
    providerOrderId,
    orderId: providerOrderId,
    redemptionCode,
    salePlanDays: item.salePlanDays ?? payload.salePlanDays ?? null,
    providerSucceeded: providerSucceeded(callbackType, payload),
    payloadHash,
    itemList: itemList(payload),
  };
};
