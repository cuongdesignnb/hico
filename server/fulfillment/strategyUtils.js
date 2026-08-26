export const stableItemId = (orderId, index) => `${orderId}:item:${index}`;

const PRIVATE_PROVIDER_KEY = /(token|secret|password|qrcode|qrcodecontent|pin|puk|rcode|redemption|iccid|simnum|simnumber|cid)/i;

const sanitizeProviderValue = (value, key = '') => {
  if (PRIVATE_PROVIDER_KEY.test(key)) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitizeProviderValue(item)).filter((item) => item !== undefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .map(([childKey, childValue]) => [childKey, sanitizeProviderValue(childValue, childKey)])
      .filter(([, childValue]) => childValue !== undefined));
  }
  return value;
};

export const safeProviderFields = (payload = {}) => sanitizeProviderValue(payload) ?? {};

export const extractProvisioningData = (item = {}) => Object.fromEntries(
  Object.entries({
    iccid: item.iccid,
    couponIccid: item.couponIccid ?? item.iccid,
    cid: item.cid,
    redemptionCode: item.redemptionCode ?? item.rcode,
    qrcode: item.qrcode,
    qrcodeContent: item.qrcodeContent,
    pin1: item.pin1,
    pin2: item.pin2,
    puk1: item.puk1,
    puk2: item.puk2,
    cfCode: item.cfCode,
    apnExplain: item.apnExplain,
    salePlanDays: item.salePlanDays,
  }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const providerCallbackResult = (payload = {}) => {
  for (const field of ['resultcode', 'resultCode', 'code']) {
    if (!hasOwn(payload, field)) continue;
    const value = payload[field];
    const success = field === 'resultcode' || field === 'resultCode'
      ? String(value) === '000' || Number(value) === 0
      : Number(value) === 0;
    const safeValue = String(value ?? 'UNKNOWN').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32) || 'UNKNOWN';
    return {
      explicit: true,
      success,
      failureCode: success ? null : `WORLDMOVE_${field.toUpperCase()}_${safeValue}`,
    };
  }
  return { explicit: false, success: null, failureCode: null };
};

export const result = (state, extra = {}) => ({ state, ...extra });
