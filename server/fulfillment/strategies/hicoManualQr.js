import { result } from '../strategyUtils.js';

export const createHicoManualQrStrategy = ({ qrRepository }) => ({
  async execute({ order, item, itemId }) {
    let qr;
    try {
      qr = await qrRepository.reserve({ variantId: item.variantId, orderId: order.orderId, orderItemId: itemId });
    } catch (error) {
      if (error?.code === 'MANUAL_QR_UNAVAILABLE') return result('PENDING_QR_ASSIGN');
      throw error;
    }
    return result('PROVISIONED', {
      providerReference: qr.id,
      itemData: {
        productName: item.productName,
        manualQrId: qr.id,
        manualQrAssignedAt: qr.assignedAt,
      },
    });
  },
});
