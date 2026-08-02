export type CustomerNotificationType = 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED' | 'ESIM_PROVISIONED' | 'ESIM_PENDING_QR' | 'PHYSICAL_SIM_SHIPPED' | 'TOPUP_COMPLETED' | 'LOYALTY_EARNED' | 'LOYALTY_REVERSED' | 'REFERRAL_APPLIED' | 'REFERRAL_QUALIFIED' | 'REFERRAL_REWARD' | 'SECURITY_EVENT';

export interface CustomerNotification {
  id: string;
  customerId: string;
  type: CustomerNotificationType;
  title: string;
  message: string;
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  dedupeKey: string;
  entityType: string | null;
  entityId: string | null;
  actionPath: string | null;
  createdAt: string;
  readAt: string | null;
  expiresAt: string | null;
}

export interface CustomerNotificationList {
  items: CustomerNotification[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  generatedAt: string;
}
