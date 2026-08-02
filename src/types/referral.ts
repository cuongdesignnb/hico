export type ReferralStatus = 'PENDING' | 'QUALIFIED' | 'REWARDED' | 'REVERSED' | 'REJECTED' | 'MANUAL_REVIEW';

export interface CustomerReferralRelationship {
  id: string;
  role: 'REFERRER' | 'REFEREE';
  status: ReferralStatus;
  code: string | null;
  createdAt: string;
  qualifiedAt: string | null;
  reversedAt: string | null;
}

export interface CustomerReferralCode {
  id: string;
  code: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
}

export interface CustomerReferralOverview {
  enabled: boolean;
  available: boolean;
  code: CustomerReferralCode | null;
  relationships: CustomerReferralRelationship[];
  pagination?: { page: number; pageSize: number; totalItems: number; totalPages: number };
  generatedAt: string;
}
