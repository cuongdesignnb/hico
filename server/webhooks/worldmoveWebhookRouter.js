import express from 'express';
import { sendCheckoutError } from '../checkout/checkoutError.js';
import { readWebhookConfig, verifyWebhookSignature } from './webhookSignature.js';
import { normalizeWebhookEvent } from './webhookValidation.js';
import { parseWorldmoveRawCallback } from './worldmoveRawCallback.js';

export const createWorldmoveWebhookRouter = ({ fulfillmentService, replayRepository, env = process.env, logger = console, rateLimitPerMinute = Number(env.CHECKOUT_RATE_LIMIT_PER_MINUTE ?? 120) } = {}) => {
  const router = express.Router();
  const config = readWebhookConfig(env);
  const providerConfig = {
    merchantId: typeof env.WORLDMOVE_MERCHANT_ID === 'string' ? env.WORLDMOVE_MERCHANT_ID : '',
    token: typeof env.WORLDMOVE_TOKEN === 'string' ? env.WORLDMOVE_TOKEN : '',
  };
  const rateLimit = Number.isFinite(rateLimitPerMinute) && rateLimitPerMinute > 0 ? rateLimitPerMinute : 120;
  const rateWindow = new Map();
  router.post('/events', (req, res) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const current = rateWindow.get(ip);
    if (!current || current.expiresAt < now) rateWindow.set(ip, { count: 1, expiresAt: now + 60000 });
    else if (current.count >= rateLimit) return res.status(429).json({ error: 'Too many webhook requests.', code: 'WEBHOOK_RATE_LIMITED' });
    else current.count += 1;

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body ?? {});
    const internalTimestamp = req.get('x-worldmove-timestamp');
    const internalSignature = req.get('x-worldmove-signature');
    const isInternalEvent = Boolean(internalTimestamp || internalSignature);
    let event;
    try {
      const payload = JSON.parse(rawBody);
      if (isInternalEvent) {
        const verified = verifyWebhookSignature({
          rawBody,
          timestamp: internalTimestamp,
          signature: internalSignature,
          secret: config.secret,
          toleranceSeconds: config.toleranceSeconds,
        });
        if (!verified.valid) return res.status(401).json({ error: 'Webhook signature is invalid.', code: verified.code });
        event = normalizeWebhookEvent(payload, rawBody);
      } else {
        event = parseWorldmoveRawCallback({ ...providerConfig, payload, rawBody });
      }
    } catch (error) {
      if (!isInternalEvent && error?.status) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      if (!isInternalEvent) {
        return res.status(400).json({ error: 'Worldmove callback payload is invalid.', code: 'WORLDMOVE_RAW_CALLBACK_INVALID' });
      }
      return sendCheckoutError(res, error);
    }
    Promise.resolve().then(async () => {
      const claim = await replayRepository.add(event.eventId, { payloadHash: event.payloadHash, providerOrderId: event.providerOrderId });
      if (!claim.fresh) return { duplicate: true };
      try {
        const result = await fulfillmentService.handleWebhookEvent(event);
        if (!result) await replayRepository.remove(event.eventId);
        return result;
      } catch (error) {
        await replayRepository.remove(event.eventId);
        throw error;
      }
    }).then((result) => {
      if (!result && !isInternalEvent) return res.type('text/plain').status(200).send('1');
      if (!result) return res.status(404).json({ error: 'Provider order not found.', code: 'PROVIDER_ORDER_NOT_FOUND' });
      if (!isInternalEvent) return res.type('text/plain').status(200).send('1');
      return res.status(200).json({ ok: true, duplicate: Boolean(result.duplicate), orderId: result.orderId ?? null, status: result.status ?? 'accepted' });
    }).catch((error) => {
      logger.warn(`[webhook] processing failed code=${error?.code ?? 'unknown'}`);
      if (error?.retryable) return res.status(503).json({ error: 'Webhook processing is temporarily unavailable.', code: 'WEBHOOK_PROCESSING_RETRYABLE' });
      return res.status(500).json({ error: 'Webhook processing failed.', code: 'WEBHOOK_PROCESSING_FAILED' });
    });
    return undefined;
  });
  return router;
};
