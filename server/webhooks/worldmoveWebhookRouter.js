import express from 'express';
import { sendCheckoutError } from '../checkout/checkoutError.js';
import { readWebhookConfig, verifyWebhookSignature } from './webhookSignature.js';
import { normalizeWebhookEvent } from './webhookValidation.js';
import { normalizeWorldmoveCallback } from '../providers/worldmove/worldmoveCallback.js';

export const createWorldmoveWebhookRouter = ({ fulfillmentService, replayRepository, merchantId = process.env.WORLDMOVE_MERCHANT_ID, token = process.env.WORLDMOVE_TOKEN, env = process.env, logger = console, rateLimitPerMinute = Number(env.CHECKOUT_RATE_LIMIT_PER_MINUTE ?? 120) } = {}) => {
  const router = express.Router();
  const config = readWebhookConfig(env);
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
    let event;
    try {
      const payload = JSON.parse(rawBody);
      if (merchantId && token) {
        event = normalizeWorldmoveCallback(payload, rawBody, { merchantId, token });
      } else {
        const verified = verifyWebhookSignature({
          rawBody,
          timestamp: req.get('x-worldmove-timestamp'),
          signature: req.get('x-worldmove-signature'),
          secret: config.secret,
          toleranceSeconds: config.toleranceSeconds,
        });
        if (!verified.valid) return res.status(401).json({ error: 'Webhook signature is invalid.', code: verified.code });
        event = normalizeWebhookEvent(payload, rawBody);
      }
    } catch (error) {
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
      if (!result) return res.status(404).json({ error: 'Provider order not found.', code: 'PROVIDER_ORDER_NOT_FOUND' });
      return res.type('text/plain').status(200).send('1');
    }).catch((error) => {
      logger.warn(`[webhook] processing failed code=${error?.code ?? 'unknown'}`);
      if (error?.retryable) return res.status(503).json({ error: 'Webhook processing is temporarily unavailable.', code: 'WEBHOOK_PROCESSING_RETRYABLE' });
      return res.status(500).json({ error: 'Webhook processing failed.', code: 'WEBHOOK_PROCESSING_FAILED' });
    });
    return undefined;
  });
  return router;
};
