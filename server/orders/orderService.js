import { createOrderId } from './orderRepository.js';
import { projectOrderForDashboard } from './orderValidation.js';

export const createOrderService = ({ repository, fulfillmentService }) => ({
  async createCanonicalOrder({ request, validated, snapshotFactory }) {
    const order = snapshotFactory({
      orderId: createOrderId(),
      request,
      validated,
      createdAt: new Date().toISOString(),
    });
    const saved = await repository.create(order);
    const fulfillment = await fulfillmentService.createForOrder(saved);
    return repository.update(saved.orderId, (current) => ({
      ...current,
      status: fulfillment.orderStatus,
      fulfillmentRecordIds: fulfillment.records.map((record) => record.id),
    }));
  },
  async getForDashboard(orderId) {
    const order = await repository.get(orderId);
    return order ? projectOrderForDashboard(order) : null;
  },
});
