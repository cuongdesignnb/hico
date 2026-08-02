import axios from 'axios';

export const createAlertService = ({ env = process.env, logger = console, transport } = {}) => {
  const send = transport ?? (async (payload) => {
    if (!env.ALERT_WEBHOOK_URL) return { delivered: false, reason: 'not_configured' };
    await axios.post(env.ALERT_WEBHOOK_URL, payload, { timeout: Number.parseInt(env.ALERT_TIMEOUT_MS, 10) || 5_000 });
    return { delivered: true };
  });
  return {
    async raise({ type, severity = 'warning', message, requestId }) {
      const payload = { source: 'hico', type, severity, message, requestId, occurredAt: new Date().toISOString() };
      try { const result = await send(payload); logger.info?.({ event: 'alert_delivery', type, severity, delivered: result.delivered }); return result; }
      catch { logger.error?.({ event: 'alert_delivery_failed', type, severity }); return { delivered: false, reason: 'delivery_failed' }; }
    },
  };
};
