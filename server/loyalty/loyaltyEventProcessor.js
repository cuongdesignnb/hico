import { itemOperation } from './loyaltyRules.js';

export const createLoyaltyEventProcessor = ({ loyaltyService = null, referralService = null, notificationEventProcessor = null, logger = console } = {}) => ({
  async onFulfillmentState({ record, order, item, eventId = null } = {}) {
    if (!record) return { skipped: true, reason: 'MILESTONE_NOT_COMPLETE' };
    const customerId = order?.customerId ?? null;
    const orderId = order?.orderId ?? record.orderId;
    const eventVersion = eventId ?? `${record.updatedAt ?? record.id}:${record.state}`;
    const emit = async (type) => {
      if (!notificationEventProcessor || !customerId) return;
      await notificationEventProcessor.emit({ customerId, type, entityType: 'ORDER', entityId: orderId, eventVersion, actionPath: `/tai-khoan/don-hang/${encodeURIComponent(orderId)}` });
    };
    const safely = async (operation, reason) => {
      if (!operation) return { skipped: true, reason };
      try { return await operation(); }
      catch (error) { logger.warn?.(`[loyalty] ${reason} skipped code=${error?.code ?? 'unknown'}`); return { skipped: true, reason }; }
    };
    try {
      if (record.state === 'CANCELLED') {
        const loyalty = await safely(loyaltyService?.reverseForFulfillment ? () => loyaltyService.reverseForFulfillment({ orderId, orderItemId: record.orderItemId, eventId, reason: 'fulfillment_cancelled' }) : null, 'reversal');
        const referral = await safely(referralService?.reverseForFulfillment ? () => referralService.reverseForFulfillment({ orderId, refereeCustomerId: customerId, eventId }) : null, 'referral reversal');
        await emit('ORDER_STATUS_CHANGED');
        return { loyalty, referral };
      }
      if (record.state === 'PENDING_QR_ASSIGN' && itemOperation(item) === 'esim') await emit('ESIM_PENDING_QR');
      if (!['PROVISIONED', 'SHIPPED'].includes(record.state)) {
        await emit('ORDER_STATUS_CHANGED');
        return { skipped: true, reason: 'MILESTONE_NOT_COMPLETE' };
      }
      const loyalty = await safely(loyaltyService?.earnForFulfillment ? () => loyaltyService.earnForFulfillment({ orderId, orderItemId: record.orderItemId, milestone: record.state, eventId, item }) : null, 'earn');
      const referral = await safely(referralService?.qualifyForFulfillment ? () => referralService.qualifyForFulfillment({ record, order, item, eventId }) : null, 'referral qualification');
      if (record.state === 'PROVISIONED') await emit(itemOperation(item) === 'topup' ? 'TOPUP_COMPLETED' : 'ESIM_PROVISIONED');
      if (record.state === 'SHIPPED' && ['physical_sim', 'device_sale'].includes(itemOperation(item))) await emit('PHYSICAL_SIM_SHIPPED');
      await emit('ORDER_STATUS_CHANGED');
      return { loyalty, referral };
    } catch (error) {
      logger.warn?.(`[loyalty] event skipped code=${error?.code ?? 'unknown'}`);
      return { skipped: true, reason: 'LOYALTY_EVENT_FAILED' };
    }
  },
});
