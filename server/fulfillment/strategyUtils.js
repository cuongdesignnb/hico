export const stableItemId = (orderId, index) => `${orderId}:item:${index}`;

export const safeProviderFields = (payload = {}) => Object.fromEntries(
  Object.entries(payload).filter(([key]) => !/(token|secret|password|qrcode|qrcodecontent|pin|puk|rcode|redemption)/i.test(key)),
);

export const extractProvisioningData = (item = {}) => Object.fromEntries(
  Object.entries({
    iccid: item.iccid,
    redemptionCode: item.redemptionCode ?? item.rcode,
    qrcode: item.qrcode,
    qrcodeContent: item.qrcodeContent,
    pin1: item.pin1,
    pin2: item.pin2,
    puk1: item.puk1,
    puk2: item.puk2,
    apnExplain: item.apnExplain,
  }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
);

export const result = (state, extra = {}) => ({ state, ...extra });
