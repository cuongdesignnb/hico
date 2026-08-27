import { CheckoutError } from '../checkout/checkoutError.js';
import { createFulfillmentId } from './fulfillmentRepository.js';
import { transitionFulfillment } from './fulfillmentStateMachine.js';
import { createFulfillmentRegistry } from './fulfillmentRegistry.js';
import {
  createWorldmoveEsimRedeemStrategy,
} from './strategies/worldmoveEsimRedeem.js';
import { createWorldmoveEsimOrderThenRedeemStrategy } from './strategies/worldmoveEsimOrderThenRedeem.js';
import { createHicoManualQrStrategy } from './strategies/hicoManualQr.js';
import { createHicoPhysicalStockStrategy } from './strategies/hicoPhysicalStock.js';
import { createManualProcessingStrategy } from './strategies/manualProcessing.js';
import { stableItemId } from './strategyUtils.js';
import { validateProvisioningEntitlement } from '../catalog/fulfillment/fulfillmentValidation.js';

const RETRYABLE_CODES = new Set(['PROVIDER_TIMEOUT', 'PROVIDER_REQUEST_FAILED', 'MANUAL_QR_UNAVAILABLE', 'PHYSICAL_STOCK_UNAVAILABLE']);

const mapOrderStatus = (records) => {
  if (records.some((record) => record.state === 'PENDING_QR_ASSIGN')) return 'PENDING_QR_ASSIGN';
  if (records.some((record) => record.state === 'PENDING_SHIP')) return 'PENDING_SHIP';
  if (records.some((record) => record.state === 'PENDING_CALLBACK' || record.state === 'FAILED_RETRYABLE')) return 'PENDING_CALLBACK';
  if (records.length > 0 && records.every((record) => record.state === 'SHIPPED')) return 'SHIPPED';
  if (records.length > 0 && records.every((record) => record.state === 'PROVISIONED')) return 'PROVISIONED';
  return 'PENDING_CALLBACK';
};

export const createDefaultFulfillmentRegistry = ({ qrRepository, inventoryRepository }) => createFulfillmentRegistry({
  WORLDMOVE_ESIM_REDEEM: createWorldmoveEsimRedeemStrategy(),
  WORLDMOVE_ESIM_ORDER_THEN_REDEEM: createWorldmoveEsimOrderThenRedeemStrategy(),
  HICO_MANUAL_QR: createHicoManualQrStrategy({ qrRepository }),
  HICO_PHYSICAL_STOCK: createHicoPhysicalStockStrategy({ inventoryRepository }),
  MANUAL_PROCESSING: createManualProcessingStrategy(),
});

export const createFulfillmentService = ({
  repository,
  idempotencyRepository,
  orderRepository,
  providerClient,
  qrRepository,
  inventoryRepository,
  registry = createDefaultFulfillmentRegistry({ qrRepository, inventoryRepository }),
  eventRepository = null,
  logger = console,
  sideEffectSink = async () => undefined,
  loyaltyEventProcessor = null,
} = {}) => {
  const saveItemData = async (orderId, itemIndex, itemData = {}, nextStatus) => orderRepository.update(orderId, (order) => {
    const items = [...order.items];
    items[itemIndex] = { ...items[itemIndex], ...itemData };
    return { ...order, items, status: nextStatus };
  });

  const executeRecord = async (record, order, item, strategy, event = null) => {
    const processing = record.state === 'PENDING' || record.state === 'FAILED_RETRYABLE'
      ? transitionFulfillment(record, 'PROCESSING', event ? 'webhook_retry' : 'checkout_create')
      : record;
    if (processing !== record) await repository.update(record.id, processing);
    try {
      if (event) validateProvisioningEntitlement({ item, event });
      const response = event && strategy.callback
        ? await strategy.callback({ order, item, itemId: record.orderItemId, event, providerClient, record })
        : await strategy.execute({ order, item, itemId: record.orderItemId, providerClient, record });
      const next = transitionFulfillment(processing, response.state, event?.eventType ?? 'strategy_result');
      const saved = await repository.update(record.id, {
        ...next,
        providerReference: response.providerReference ?? processing.providerReference,
        providerResponse: response.providerResponse,
        completedAt: response.completedAt ?? processing.completedAt,
        failureCode: response.failureCode ?? processing.failureCode,
        itemData: { ...(processing.itemData ?? {}), ...(response.itemData ?? {}) },
        inventoryMovementId: response.inventoryMovementId ?? processing.inventoryMovementId,
        internalNote: response.internalNote ?? processing.internalNote,
        trackingCode: response.trackingCode ?? processing.trackingCode,
        lastErrorCode: null,
      });
      const marker = response.state === 'PROVISIONED'
        ? (item.operation === 'topup' ? 'TOPUP_COMPLETED_EMAIL_SENT' : 'PROVISIONED_EMAIL_SENT')
        : response.state === 'SHIPPED' ? 'SHIPPING_EMAIL_SENT' : null;
      let marked = saved;
      if (marker && !saved.sideEffectMarkers?.includes(marker)) {
        marked = await repository.update(record.id, {
          ...saved,
          sideEffectMarkers: [...(saved.sideEffectMarkers ?? []), marker],
        });
        try {
          await sideEffectSink({ marker, order, record: marked });
        } catch (sideEffectError) {
          logger.warn(`[fulfillment] side effect failed marker=${marker} code=${sideEffectError?.code ?? 'unknown'}`);
        }
      }
      if (loyaltyEventProcessor && ['PROVISIONED', 'SHIPPED', 'CANCELLED', 'PENDING_QR_ASSIGN', 'PENDING_SHIP', 'PENDING_CALLBACK'].includes(marked.state)) {
        await loyaltyEventProcessor.onFulfillmentState({ record: marked, order, item, eventId: event?.eventId ?? null });
      }
      return marked;
    } catch (error) {
      const code = error?.code ?? 'PROVIDER_REQUEST_FAILED';
      const retryable = RETRYABLE_CODES.has(code) || error?.retryable === true;
      const failureState = transitionFulfillment(
        processing,
        retryable ? 'FAILED_RETRYABLE' : 'FAILED',
        'strategy_error',
      );
      await repository.update(record.id, {
        ...failureState,
        lastErrorCode: code,
        lastErrorMessage: retryable ? 'Fulfillment provider or inventory is temporarily unavailable.' : 'Fulfillment failed.',
      });
      throw error;
    }
  };

  const createForOrder = async (order) => {
    const existing = await repository.findByOrderId(order.orderId);
    if (existing.length) return { records: existing, orderStatus: mapOrderStatus(existing) };
    const records = [];
    for (let index = 0; index < order.items.length; index += 1) {
      const item = order.items[index];
      const record = {
        id: createFulfillmentId(),
        orderId: order.orderId,
        orderItemId: stableItemId(order.orderId, index),
        itemIndex: index,
        fulfillmentMethod: item.fulfillmentMethod,
        state: 'PENDING',
        attemptId: `attempt-${createFulfillmentId()}`,
        idempotencyKey: `${order.orderId}:${stableItemId(order.orderId, index)}:INITIAL`,
        requestHash: idempotencyRepository.hash({ orderId: order.orderId, item }),
        providerReference: null,
        lastErrorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repository.create(record);
      records.push(record);
    }

    const completed = [];
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const item = order.items[index];
      const strategy = registry.resolve(item);
      try {
        completed.push(await executeRecord(record, order, item, strategy));
      } catch (error) {
        logger.warn(`[fulfillment] attempt failed code=${error?.code ?? 'unknown'}`);
        throw error;
      }
    }
    for (const record of completed) {
      if (record?.itemData) await saveItemData(order.orderId, record.itemIndex, record.itemData, mapOrderStatus(completed));
    }
    return { records: completed, orderStatus: mapOrderStatus(completed) };
  };

  const retry = async (orderId) => {
    const order = await orderRepository.get(orderId);
    if (!order) throw new CheckoutError('Không tìm thấy đơn hàng.', 'ORDER_NOT_FOUND', 404);
    if (order.status === 'CANCELLED') throw new CheckoutError('Đơn hàng đã hủy.', 'ORDER_STATE_CONFLICT', 409);
    const records = await repository.findByOrderId(orderId);
    const retried = [];
    for (const record of records) {
      if (!['FAILED_RETRYABLE', 'PENDING_CALLBACK', 'PENDING_QR_ASSIGN'].includes(record.state)) {
        retried.push(record);
        continue;
      }
      const item = order.items[record.itemIndex];
      const strategy = registry.resolve(item);
      try {
        retried.push(await executeRecord(record, order, item, strategy));
      } catch (error) {
        logger.warn(`[fulfillment] retry failed code=${error?.code ?? 'unknown'}`);
        retried.push(await repository.get(record.id));
      }
    }
    const status = mapOrderStatus(retried);
    const updated = await orderRepository.update(orderId, { ...order, status });
    return { order: updated, records: retried };
  };

  const assignManualQr = async ({ orderId, orderItemId, qrId }) => {
    const order = await orderRepository.get(orderId);
    if (!order) throw new CheckoutError('Không tìm thấy đơn hàng.', 'ORDER_NOT_FOUND', 404);
    const records = await repository.findByOrderId(orderId);
    const record = records.find((candidate) => candidate.orderItemId === orderItemId);
    if (!record) throw new CheckoutError('Không tìm thấy fulfillment của đơn hàng.', 'FULFILLMENT_NOT_FOUND', 404);
    const item = order.items[record.itemIndex];
    if (item?.fulfillmentMethod !== 'HICO_MANUAL_QR') {
      throw new CheckoutError('Fulfillment của đơn hàng không phải manual QR.', 'FULFILLMENT_METHOD_INVALID', 409);
    }
    if (!['PENDING_QR_ASSIGN', 'PROVISIONED'].includes(record.state)) {
      throw new CheckoutError('Fulfillment không còn chờ gán QR.', 'ORDER_STATE_CONFLICT', 409);
    }
    if (record.state === 'PROVISIONED' && item.manualQrId !== qrId) {
      throw new CheckoutError('Fulfillment đã được gán QR khác.', 'ORDER_STATE_CONFLICT', 409);
    }
    await qrRepository.assign({ id: qrId, variantId: item.variantId, orderId, orderItemId });
    if (record.state === 'PROVISIONED') return { order, record };
    const strategy = registry.resolve(item);
    const assigned = await executeRecord(record, order, item, strategy);
    const updatedOrder = await orderRepository.update(orderId, (current) => ({
      ...current,
      items: current.items.map((candidate, index) => index === record.itemIndex
        ? { ...candidate, ...(assigned.itemData ?? {}) }
        : candidate),
      status: mapOrderStatus([...(records.filter((candidate) => candidate.id !== record.id)), assigned]),
    }));
    return { order: updatedOrder, record: assigned };
  };

  const handleWebhookEvent = async (event) => {
    if (eventRepository) {
      const existing = await eventRepository.get(event.eventId);
      if (existing) return { duplicate: true, orderId: existing.orderId, status: existing.status };
    }
    let records = await repository.findByProviderReference(event.providerOrderId ?? event.orderId);
    if (!records.length && event.callbackType === 'REDEEM_CALLBACK' && event.rcode && repository.findByItemData) {
      records = await repository.findByItemData('redemptionCode', event.rcode);
    }
    if (!records.length) return null;
    const order = await orderRepository.get(records[0].orderId);
    if (!order || order.status === 'CANCELLED') {
      if (eventRepository) await eventRepository.save({ eventId: event.eventId, orderId: order?.orderId ?? null, status: 'ignored' });
      return { duplicate: false, ignored: true, orderId: order?.orderId ?? null };
    }
    const results = [];
    for (const record of records) {
      const item = order.items[record.itemIndex];
      const strategy = registry.resolve(item);
      results.push(await executeRecord(record, order, item, strategy, event));
    }
    const status = mapOrderStatus(results);
    await orderRepository.update(order.orderId, { ...order, status });
    for (const record of results) {
      if (record?.itemData) await saveItemData(order.orderId, record.itemIndex, record.itemData, status);
    }
    if (eventRepository) await eventRepository.save({ eventId: event.eventId, orderId: order.orderId, status: 'processed' });
    return { duplicate: false, orderId: order.orderId, status };
  };

  return {
    registry,
    createForOrder,
    retry,
    assignManualQr,
    handleWebhookEvent,
    mapOrderStatus,
  };
};
