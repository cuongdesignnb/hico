import { ORDER_STATUSES } from './orderValidation.js';

const ALLOWED = {
  PENDING_CALLBACK: new Set(['PENDING_CALLBACK', 'PROVISIONED', 'CANCELLED', 'PENDING_SHIP']),
  PENDING_QR_ASSIGN: new Set(['PENDING_QR_ASSIGN', 'PROVISIONED', 'CANCELLED']),
  PENDING_SHIP: new Set(['PENDING_SHIP', 'SHIPPED', 'CANCELLED']),
  PROVISIONED: new Set(['PROVISIONED']),
  SHIPPED: new Set(['SHIPPED']),
  CANCELLED: new Set(['CANCELLED']),
};

export class OrderStateConflictError extends Error {
  constructor(message = 'Order state transition is not allowed.') {
    super(message);
    this.name = 'OrderStateConflictError';
    this.code = 'ORDER_STATE_CONFLICT';
    this.status = 409;
  }
}

export const canTransitionOrder = (from, to) => Boolean(
  ORDER_STATUSES.has(from) && ORDER_STATUSES.has(to) && ALLOWED[from]?.has(to),
);

export const transitionOrder = (order, nextStatus, event = 'fulfillment') => {
  if (!canTransitionOrder(order.status, nextStatus)) throw new OrderStateConflictError();
  return {
    ...order,
    status: nextStatus,
    lastStateEvent: event,
    updatedAt: new Date().toISOString(),
  };
};
