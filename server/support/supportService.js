const codeError = (code, message) => Object.assign(new Error(message), { code });
const clean = (value, max) => { const result = String(value ?? '').trim().slice(0, max); return result && !/[<>]/.test(result) ? result : null; };
const categories = new Set(['ACCOUNT', 'ORDER', 'ASSET', 'TECHNICAL', 'OTHER']);
const priorities = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const statuses = new Set(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']);

export const createSupportService = ({ repository, orderRepository, assetRepository, attachmentService, notificationEventProcessor = null, env = process.env, securityAudit = () => {}, now = () => new Date() } = {}) => {
  const enabled = String(env.CUSTOMER_SUPPORT_ENABLED ?? '').toLowerCase() === 'true';
  const ready = () => { if (!enabled) throw codeError('SUPPORT_NOT_READY', 'Customer support is unavailable.'); };
  const notify = async (event) => { try { await notificationEventProcessor?.emit?.(event); } catch { /* notification delivery is retried independently */ } };
  const validateInput = (input, requireBody = true) => {
    const subject = clean(input.subject, 160); const body = clean(input.body, 5000); const category = String(input.category ?? '').toUpperCase(); const priority = String(input.priority ?? 'NORMAL').toUpperCase();
    if (!subject || (requireBody && !body) || !categories.has(category) || !priorities.has(priority)) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support ticket input is invalid.');
    return { subject, body, category, priority, orderId: input.orderId ? String(input.orderId).slice(0, 120) : null, customerAssetId: input.customerAssetId ? String(input.customerAssetId).slice(0, 160) : null };
  };
  const assertLinksOwned = async (customerId, input) => {
    if (input.orderId && (!orderRepository?.getForCustomer || !await orderRepository.getForCustomer(input.orderId, customerId))) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support ticket was not found.');
    if (input.customerAssetId && (!assetRepository?.get || !await assetRepository.get(customerId, input.customerAssetId).catch(() => null))) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support ticket was not found.');
  };
  const assertCustomerTicket = async (customerId, ticketId) => { const detail = await repository.getForCustomer(customerId, ticketId); if (!detail) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support ticket was not found.'); return detail; };
  return {
    enabled,
    async customerList(customerId, query) { ready(); return repository.listForCustomer(customerId, query); },
    async customerGet(customerId, ticketId) { ready(); return assertCustomerTicket(customerId, ticketId); },
    async createCustomerTicket(customerId, input, requestId) {
      ready(); const valid = validateInput(input); await assertLinksOwned(customerId, valid); const result = await repository.createTicket({ ...valid, customerId });
      securityAudit({ event: 'support_ticket_created', actorId: customerId, requestId, ticketId: result.ticket.id });
      await notify({ customerId, type: 'SUPPORT_TICKET_CREATED', entityType: 'SUPPORT_TICKET', entityId: result.ticket.id, eventVersion: result.ticket.createdAt, actionPath: `/tai-khoan/ho-tro/${encodeURIComponent(result.ticket.id)}` });
      return result;
    },
    async addCustomerMessage(customerId, ticketId, body, requestId) {
      ready(); await assertCustomerTicket(customerId, ticketId); const cleanBody = clean(body, 5000); if (!cleanBody) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Message is invalid.');
      const result = await repository.addMessage({ ticketId, senderType: 'CUSTOMER', senderCustomerId: customerId, visibility: 'CUSTOMER', body: cleanBody });
      securityAudit({ event: 'support_customer_message', actorId: customerId, requestId, ticketId });
      return result;
    },
    async closeCustomerTicket(customerId, ticketId, requestId) {
      ready(); const result = await repository.closeForCustomer(customerId, ticketId); if (!result) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support ticket was not found.');
      securityAudit({ event: 'support_ticket_closed', actorId: customerId, requestId, ticketId });
      await notify({ customerId, type: 'SUPPORT_TICKET_CLOSED', entityType: 'SUPPORT_TICKET', entityId: ticketId, eventVersion: result.updatedAt, actionPath: `/tai-khoan/ho-tro/${encodeURIComponent(ticketId)}` });
      return result;
    },
    async adminList(query) { ready(); return repository.listForAdmin(query); },
    async adminGet(ticketId) { ready(); const result = await repository.getForAdmin(ticketId); if (!result) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support ticket was not found.'); return result; },
    async adminMessage(ticketId, body, actorId, requestId) {
      ready(); const current = await repository.getForAdmin(ticketId); if (!current) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support ticket was not found.'); const cleanBody = clean(body, 5000); if (!cleanBody) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Message is invalid.');
      const result = await repository.addMessage({ ticketId, senderType: 'ADMIN', senderAdminId: actorId, visibility: 'CUSTOMER', body: cleanBody });
      securityAudit({ event: 'support_admin_message', actorId, requestId, ticketId });
      await notify({ customerId: current.ticket.customerId, type: 'SUPPORT_REPLY_RECEIVED', entityType: 'SUPPORT_TICKET', entityId: ticketId, eventVersion: result.ticket.updatedAt, actionPath: `/tai-khoan/ho-tro/${encodeURIComponent(ticketId)}` });
      return result;
    },
    async adminInternalMessage(ticketId, body, actorId, requestId) {
      ready(); const current = await repository.getForAdmin(ticketId); if (!current) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support ticket was not found.'); const cleanBody = clean(body, 5000); if (!cleanBody) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Message is invalid.');
      const result = await repository.addMessage({ ticketId, senderType: 'ADMIN', senderAdminId: actorId, visibility: 'INTERNAL', body: cleanBody }); securityAudit({ event: 'support_admin_internal_note', actorId, requestId, ticketId }); return result;
    },
    async adminUpdate(ticketId, input, actorId, requestId) {
      ready(); const current = await repository.getForAdmin(ticketId); if (!current) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support ticket was not found.');
      const update = {}; if (input.status && statuses.has(String(input.status).toUpperCase())) update.status = String(input.status).toUpperCase(); else if (input.status) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support status is invalid.');
      if (input.priority && priorities.has(String(input.priority).toUpperCase())) update.priority = String(input.priority).toUpperCase(); else if (input.priority) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'Support priority is invalid.');
      if (Object.hasOwn(input, 'assignedAdminId')) update.assignedAdminId = input.assignedAdminId || null;
      if ((update.status && update.status !== current.ticket.status) && !clean(input.reason, 500)) throw codeError('SUPPORT_TICKET_NOT_FOUND', 'A reason is required for status changes.');
      const result = await repository.adminUpdate(ticketId, update); securityAudit({ event: 'support_admin_update', actorId, requestId, ticketId, reason: clean(input.reason, 500), status: update.status, assignedAdminId: update.assignedAdminId });
      if (update.status && update.status !== current.ticket.status) await notify({ customerId: result.customerId, type: update.status === 'CLOSED' ? 'SUPPORT_TICKET_CLOSED' : 'SUPPORT_STATUS_CHANGED', entityType: 'SUPPORT_TICKET', entityId: ticketId, eventVersion: result.updatedAt, actionPath: `/tai-khoan/ho-tro/${encodeURIComponent(ticketId)}` });
      return result;
    },
    async uploadAttachment({ ticketId, customerId, adminId, fileName, mimeType, contentBase64, requestId }) {
      ready(); const current = customerId ? await assertCustomerTicket(customerId, ticketId) : await this.adminGet(ticketId); const uploadedByType = customerId ? 'CUSTOMER' : 'ADMIN'; const uploadedById = customerId ?? adminId;
      const result = await attachmentService.upload({ ticketId, uploadedByType, uploadedById, fileName, mimeType, contentBase64 }); securityAudit({ event: 'support_attachment_uploaded', actorId: uploadedById, requestId, ticketId, attachmentId: result.id, scanner: result.scanner, risk: result.risk }); return result;
    },
    async readAttachment(id, { customerId = null } = {}) { ready(); const attachment = await repository.getAttachment(id); if (!attachment || (customerId && attachment.customerId !== customerId)) throw codeError('SUPPORT_ATTACHMENT_FORBIDDEN', 'Attachment is unavailable.'); return attachmentService.read(attachment); },
    health: () => repository.health(),
  };
};
