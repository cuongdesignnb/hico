export interface LoyaltyBalance {
  balance: number;
  earned: number;
  redeemed: number;
  reversed: number;
  reserved: number;
  entryCount: number;
}

export interface LoyaltyRule {
  id: string;
  version: string;
  currency: string;
  earnBasis: string;
  pointsPer: string;
  rounding: string;
  milestones: Record<string, string>;
  redemption: string;
  expiry: string;
}

export interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  orderId: string | null;
  orderItemId: string | null;
  ruleId: string;
  ruleVersion: string;
  effectiveAt: string;
  createdAt: string;
}

export interface LoyaltySummary {
  balance: LoyaltyBalance;
  rules: LoyaltyRule[];
  generatedAt: string;
}

export interface LoyaltyTransactionList {
  items: LoyaltyTransaction[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  generatedAt: string;
}
