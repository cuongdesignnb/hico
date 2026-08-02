import { createHash } from 'node:crypto';

export const createQuotationSignature = (merchantId, token) => (
  createHash('sha1')
    .update(`${merchantId}${token}`, 'utf8')
    .digest('hex')
    .toUpperCase()
);
