import crypto from 'node:crypto';

export const readWebhookConfig = (env = process.env) => ({
  secret: typeof env.WORLDMOVE_WEBHOOK_SECRET === 'string' ? env.WORLDMOVE_WEBHOOK_SECRET : '',
  toleranceSeconds: Number(env.WORLDMOVE_WEBHOOK_TOLERANCE_SECONDS ?? 300),
});

export const createWebhookSignature = ({ rawBody, timestamp, secret }) => `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')}`;

const constantTimeEqual = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const verifyWebhookSignature = ({ rawBody, timestamp, signature, secret, toleranceSeconds = 300, now = Date.now() }) => {
  if (!secret || !timestamp || !signature) return { valid: false, code: 'WEBHOOK_SIGNATURE_INVALID' };
  const timestampNumber = Number(timestamp);
  const timestampMs = timestampNumber > 1e12 ? timestampNumber : timestampNumber * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > toleranceSeconds * 1000) {
    return { valid: false, code: 'WEBHOOK_TIMESTAMP_EXPIRED' };
  }
  const expected = createWebhookSignature({ rawBody, timestamp, secret });
  const provided = String(signature).startsWith('sha256=') ? String(signature) : `sha256=${signature}`;
  return { valid: constantTimeEqual(expected, provided), code: constantTimeEqual(expected, provided) ? null : 'WEBHOOK_SIGNATURE_INVALID' };
};
