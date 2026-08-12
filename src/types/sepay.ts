export interface SePaySettings {
  enabled: boolean;
  provider: 'SEPAY';
  bankAccountMasked: string | null;
  accountHolder: string | null;
  bankName: string | null;
  orderReferencePrefix: string;
  webhookPath: string;
  webhookUrl: string;
  credentialConfigured: boolean;
  credentialMasked: string | null;
  credentialFingerprint: string | null;
  status: string;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
}

export interface SePayTransaction {
  id: string;
  provider: 'SEPAY';
  providerTransactionId: string;
  orderId: string | null;
  status: string;
  matchStatus: string;
  amount: number;
  currency: 'VND';
  accountMasked: string | null;
  referenceCode: string | null;
  payloadHash: string;
  createdAt: string;
  paidAt: string | null;
}

export interface SePayTransactionList {
  items: SePayTransaction[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
