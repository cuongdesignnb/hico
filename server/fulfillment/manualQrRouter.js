import express from 'express';
import { parseImageUpload } from '../security/uploadValidation.js';

const privateResponse = (res) => res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache' });
const publicRecord = (record) => ({
  id: record.id,
  variantId: record.variantId,
  assignedOrderId: record.assignedOrderId ?? null,
  assignedOrderItemId: record.assignedOrderItemId ?? null,
  assignedAt: record.assignedAt ?? null,
  createdAt: record.createdAt ?? null,
  hasImage: Boolean(record.storageKey || record.qrcode),
});
const sendError = (res, error) => {
  const status = Number.isInteger(error?.status)
    ? error.status
    : error?.code === 'MANUAL_QR_ASSIGNED' || error?.code === 'MANUAL_QR_VARIANT_MISMATCH'
      ? 409
      : error?.code?.startsWith('UPLOAD_') || error?.code === 'ASSIGN_QR_INVALID'
        ? 400
        : 500;
  return privateResponse(res).status(status).json({
    error: status === 500 ? 'Không thể xử lý kho QR riêng tư.' : error.message,
    code: error?.code ?? 'MANUAL_QR_FAILED',
  });
};

export const createManualQrRouter = ({ qrRepository, fulfillmentService = null, env = process.env } = {}) => {
  if (!qrRepository) throw new Error('Manual QR repository is required.');
  const router = express.Router();

  router.get('/admin/manual-qrs', async (_req, res) => {
    try { return privateResponse(res).json((await qrRepository.list()).map(publicRecord)); }
    catch (error) { return sendError(res, error); }
  });

  router.get('/admin/manual-qrs/:id/image', async (req, res) => {
    try {
      const image = await qrRepository.readImage(req.params.id);
      if (!image) return privateResponse(res).status(404).json({ error: 'Không tìm thấy ảnh QR.', code: 'MANUAL_QR_NOT_FOUND' });
      return privateResponse(res).type(image.mimeType).send(image.buffer);
    } catch (error) { return sendError(res, error); }
  });

  router.post('/admin/manual-qrs/upload', async (req, res) => {
    try {
      const { variantId, base64Data } = req.body ?? {};
      if (typeof variantId !== 'string' || !variantId.trim() || typeof base64Data !== 'string') {
        return privateResponse(res).status(400).json({ error: 'Thiếu variantId hoặc dữ liệu ảnh.', code: 'UPLOAD_INVALID' });
      }
      const upload = parseImageUpload({ base64Data, maxBytes: Number(env.UPLOAD_MAX_BYTES ?? 5 * 1024 * 1024) });
      const record = await qrRepository.upload({ variantId: variantId.trim(), upload });
      return privateResponse(res).status(201).json(publicRecord(record));
    } catch (error) { return sendError(res, error); }
  });

  router.delete('/admin/manual-qrs/:id', async (req, res) => {
    try {
      const removed = await qrRepository.remove(req.params.id);
      if (!removed) return privateResponse(res).status(404).json({ error: 'Không tìm thấy QR.', code: 'MANUAL_QR_NOT_FOUND' });
      return privateResponse(res).json({ success: true, id: req.params.id });
    } catch (error) { return sendError(res, error); }
  });

  router.post('/admin/orders/:orderId/assign-qr', async (req, res) => {
    try {
      if (!fulfillmentService?.assignManualQr) return privateResponse(res).status(503).json({ error: 'Manual QR fulfillment chưa sẵn sàng.', code: 'MANUAL_QR_UNAVAILABLE' });
      const { orderItemId, qrId } = req.body ?? {};
      if (typeof orderItemId !== 'string' || !orderItemId.trim() || typeof qrId !== 'string' || !qrId.trim()) {
        return privateResponse(res).status(400).json({ error: 'Thiếu orderItemId hoặc qrId.', code: 'ASSIGN_QR_INVALID' });
      }
      const result = await fulfillmentService.assignManualQr({ orderId: req.params.orderId, orderItemId: orderItemId.trim(), qrId: qrId.trim() });
      return privateResponse(res).json({ orderId: result.order.orderId, state: result.record.state, manualQrId: result.record.itemData?.manualQrId ?? null });
    } catch (error) { return sendError(res, error); }
  });
  return router;
};
