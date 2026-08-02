export const FULFILLMENT_STATES = new Set([
  'PENDING',
  'PROCESSING',
  'PENDING_CALLBACK',
  'PENDING_QR_ASSIGN',
  'PENDING_SHIP',
  'PROVISIONED',
  'SHIPPED',
  'CANCELLED',
  'FAILED_RETRYABLE',
  'FAILED',
]);

const transitions = {
  PENDING: new Set(['PROCESSING', 'CANCELLED']),
  PROCESSING: new Set(['PENDING_CALLBACK', 'PENDING_QR_ASSIGN', 'PENDING_SHIP', 'PROVISIONED', 'SHIPPED', 'FAILED_RETRYABLE', 'FAILED', 'CANCELLED']),
  PENDING_CALLBACK: new Set(['PENDING_CALLBACK', 'PROVISIONED', 'CANCELLED', 'FAILED_RETRYABLE']),
  PENDING_QR_ASSIGN: new Set(['PENDING_QR_ASSIGN', 'PROVISIONED', 'CANCELLED']),
  PENDING_SHIP: new Set(['PENDING_SHIP', 'SHIPPED', 'CANCELLED']),
  PROVISIONED: new Set(['PROVISIONED']),
  SHIPPED: new Set(['SHIPPED']),
  CANCELLED: new Set(['CANCELLED']),
  FAILED_RETRYABLE: new Set(['PROCESSING', 'FAILED_RETRYABLE', 'CANCELLED']),
  FAILED: new Set(['FAILED']),
};

export class FulfillmentStateConflictError extends Error {
  constructor() {
    super('Fulfillment state transition is not allowed.');
    this.code = 'ORDER_STATE_CONFLICT';
    this.status = 409;
  }
}

export const transitionFulfillment = (record, state, sourceEvent) => {
  if (!FULFILLMENT_STATES.has(state) || !transitions[record.state]?.has(state)) {
    throw new FulfillmentStateConflictError();
  }
  return {
    ...record,
    state,
    sourceEvent,
    updatedAt: new Date().toISOString(),
  };
};
