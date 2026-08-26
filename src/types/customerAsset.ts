export type CustomerAssetType = 'ESIM' | 'PHYSICAL_SIM' | 'DEVICE' | 'TOPUP';
export type CustomerAssetStatus = 'PENDING_CALLBACK' | 'PENDING_QR_ASSIGN' | 'PROVISIONED' | 'PENDING_SHIP' | 'SHIPPED' | 'CANCELLED' | 'FAILED' | 'FAILED_RETRYABLE';

export interface CustomerAsset {
  id: string;
  assetType: CustomerAssetType;
  orderId: string;
  orderCreatedAt: string | null;
  orderStatus: string | null;
  itemIndex: number;
  productName: string;
  productSlug: string | null;
  productId: string | null;
  variantId: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  soldPrice?: number;
  soldCurrency?: string;
  operation: string | null;
  medium: string | null;
  supplier: string | null;
  fulfillmentMethod: string | null;
  coverage: { type: string | null; ids: string[] };
  dataLimit: string | null;
  soldDataLimit?: string | null;
  duration: string | null;
  topupDays?: number | null;
  status: CustomerAssetStatus | string;
  activationStatus: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  shippingStatus: string | null;
  trackingAvailable: boolean;
  trackingMasked: string | null;
  recipientMasked: string | null;
  iccidMasked?: string | null;
  hasQr?: boolean;
  hasLpa?: boolean;
  hasPin?: boolean;
  hasPuk?: boolean;
  apnAvailable?: boolean;
  packageName?: string | null;
  simNumberMasked?: string | null;
  serialNumberMasked?: string | null;
  providerReferenceMasked?: string | null;
  completedAt?: string | null;
  failureCode?: string | null;
}

export interface CustomerAssetSummary {
  esims: { total: number; active: number; pending: number };
  physicalSims: { total: number; pendingShip: number; shipped: number };
  devices: { total: number };
  topups: { total: number; pending: number; completed: number };
  available: { esims: boolean; physicalSims: boolean; devices: boolean; topups: boolean };
}

export interface CustomerAssetList { items: CustomerAsset[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number }; generatedAt: string; }
export interface CustomerAssetSecrets { assetId: string; fields: { couponIccid: string | null; cid: string | null; iccid: string | null; qrCode: string | null; lpa: string | null; pin1: string | null; pin2: string | null; pin: string | null; puk1: string | null; puk2: string | null; puk: string | null; apn: string | null; confirmationCode: string | null }; revealedAt: string; }
