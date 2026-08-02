export const createLoyaltyEventProcessor = ({ loyaltyService, logger = console } = {}) => ({
  async onFulfillmentState({ record, order, item, eventId = null } = {}) {
    if (!record) return { skipped: true, reason: 'MILESTONE_NOT_COMPLETE' };
    try {
      if (record.state === 'CANCELLED') return await loyaltyService.reverseForFulfillment({ orderId: order?.orderId ?? record.orderId, orderItemId: record.orderItemId, eventId, reason: 'fulfillment_cancelled' });
      if (!['PROVISIONED', 'SHIPPED'].includes(record.state)) return { skipped: true, reason: 'MILESTONE_NOT_COMPLETE' };
      return await loyaltyService.earnForFulfillment({ orderId: order?.orderId ?? record.orderId, orderItemId: record.orderItemId, milestone: record.state, eventId, item });
    } catch (error) {
      logger.warn?.(`[loyalty] earn skipped code=${error?.code ?? 'unknown'}`);
      return { skipped: true, reason: 'LOYALTY_EVENT_FAILED' };
    }
  },
});
