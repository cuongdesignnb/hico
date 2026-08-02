export type ProviderProductType = 0 | 1 | 2;

export interface ProviderOffer {
  id: string;
  provider: 'worldmove';
  wmproductId: string;
  providerProductId?: string;
  providerProductName: string;
  providerProductLanguage?: string | null;
  productRegion: string;
  providerProductType: ProviderProductType;
  leSIM?: boolean | null;
  providerCost: number;
  providerCurrency: 'TWD';
  cEndPrice?: number | null;
  cEndVisible?: boolean;
  active: boolean;
  syncedAt: string;
  rawHash?: string;
}

export interface ProviderSyncResult {
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  syncedAt: string;
}
