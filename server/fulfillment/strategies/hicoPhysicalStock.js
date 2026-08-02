import { result } from '../strategyUtils.js';

export const createHicoPhysicalStockStrategy = ({ inventoryRepository }) => ({
  async execute({ order, item, itemId }) {
    const movement = await inventoryRepository.reserve({
      variant: item,
      orderId: order.orderId,
      orderItemId: itemId,
      quantity: item.quantity,
    });
    return result('PENDING_SHIP', { providerReference: movement.id, inventoryMovementId: movement.id });
  },
});
