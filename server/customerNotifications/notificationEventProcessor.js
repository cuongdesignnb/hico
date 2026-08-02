const eventCopy = {
  ORDER_CREATED: ['Don hang moi', 'Don hang cua ban da duoc tiep nhan.'],
  ORDER_STATUS_CHANGED: ['Cap nhat don hang', 'Trang thai don hang cua ban da thay doi.'],
  ESIM_PROVISIONED: ['eSIM da san sang', 'eSIM cua ban da duoc kich hoat.'],
  ESIM_PENDING_QR: ['eSIM dang cho xu ly', 'eSIM cua ban dang cho phan QR.'],
  PHYSICAL_SIM_SHIPPED: ['SIM da duoc gui', 'SIM vat ly cua ban da duoc ban giao cho van chuyen.'],
  TOPUP_COMPLETED: ['Nap them da hoan tat', 'Giao dich nap them cua ban da hoan tat.'],
  LOYALTY_EARNED: ['Diem thuong moi', 'Diem thuong da duoc ghi nhan vao tai khoan.'],
  LOYALTY_REVERSED: ['Diem thuong da hoan', 'Mot giao dich diem thuong da duoc hoan theo su kien don hang.'],
  REFERRAL_APPLIED: ['Da ap dung gioi thieu', 'Moi quan he gioi thieu cua ban da duoc ghi nhan.'],
  REFERRAL_QUALIFIED: ['Gioi thieu da du dieu kien', 'Moi quan he gioi thieu da dat su kien du dieu kien.'],
  REFERRAL_REWARD: ['Thuong gioi thieu', 'Thuong gioi thieu da duoc ghi nhan vao so cai diem.'],
  SECURITY_EVENT: ['Bao mat tai khoan', 'Tai khoan cua ban vua co mot su kien bao mat.'],
};

export const createNotificationEventProcessor = ({ notificationService, logger = console } = {}) => ({
  async emit({ customerId, type, entityType = null, entityId = null, eventVersion = 'v1', actionPath = null } = {}) {
    const copy = eventCopy[type];
    if (!customerId || !copy) return { skipped: true, reason: 'INVALID_NOTIFICATION_EVENT' };
    try {
      return await notificationService.create({
        customerId, type, title: copy[0], message: copy[1], entityType, entityId,
        actionPath, dedupeKey: `${type}:${customerId}:${entityId ?? 'none'}:${eventVersion}`,
      });
    } catch (error) {
      logger.warn?.(`[notifications] event skipped code=${error?.code ?? 'unknown'}`);
      return { skipped: true, reason: error?.code ?? 'NOTIFICATIONS_NOT_READY' };
    }
  },
});
