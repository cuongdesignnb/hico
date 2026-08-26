import crypto from 'node:crypto';

const text = (value) => String(value ?? '');

export const sha1Worldmove = (value) => (
  crypto.createHash('sha1').update(text(value), 'utf8').digest('hex').toUpperCase()
);

const contentsFor = (items, fields) => (Array.isArray(items) ? items : []).map((item) => fields.map((field) => text(item?.[field])).join('')).join('');

export const createQuotationSignature = (merchantId, token) => (
  sha1Worldmove(`${text(merchantId)}${text(token)}`)
);

export const createEsimOrderSignature = ({ merchantId, deptId, email, prodList, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(deptId)}${text(email)}${contentsFor(prodList, ['wmproductId', 'qty'])}${text(token)}`)
);

export const createEsimOrderAndRedeemSignature = ({ merchantId, deptId, qrcodeType, prodList, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(deptId)}${text(qrcodeType)}${contentsFor(prodList, ['wmproductId', 'qty'])}${text(token)}`)
);

export const createTopupSignature = ({ merchantId, deptId, prodList, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(deptId)}${contentsFor(prodList, ['wmproductId', 'day', 'simNum'])}${text(token)}`)
);

export const createRedeemSignature = ({ merchantId, rcode, qrcodeType, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(rcode)}${text(qrcodeType)}${text(token)}`)
);

export const createEsimOrderCallbackSignature = ({ merchantId, orderId, orderSN, orderTime, itemList, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(orderId)}${text(orderSN)}${text(orderTime)}${contentsFor(itemList, ['iccid', 'productName', 'redemptionCode'])}${text(token)}`)
);

export const createEsimRedeemCallbackSignature = ({ merchantId, orderId, itemList, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(orderId)}${contentsFor(itemList, ['iccid', 'productName', 'rcode', 'qrcodeType', 'qrcode'])}${text(token)}`)
);

export const createTopupCallbackSignature = ({ merchantId, orderId, itemList, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(orderId)}${contentsFor(itemList, ['wmproductId', 'day', 'simNum'])}${text(token)}`)
);

export const createRedeemCallbackSignature = ({ merchantId, qrcode, rcode, qrcodeType, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(qrcode)}${text(rcode)}${text(qrcodeType)}${text(token)}`)
);

export const createEsimUsageSignature = ({ merchantId, rcode, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(rcode)}${text(token)}`)
);

export const createSimUsageSignature = ({ merchantId, simNum, orderId, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(simNum)}${text(orderId)}${text(token)}`)
);

export const createSimExistsSignature = ({ merchantId, simNum, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(simNum)}${text(token)}`)
);

export const createOrderQuerySignature = ({ merchantId, orderId, token }) => (
  sha1Worldmove(`${text(merchantId)}${text(orderId)}${text(token)}`)
);

export const constantTimeSignatureEqual = (expected, provided) => {
  const left = Buffer.from(text(expected).toUpperCase(), 'utf8');
  const right = Buffer.from(text(provided).toUpperCase(), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
