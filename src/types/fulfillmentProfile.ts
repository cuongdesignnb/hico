export interface FulfillmentProfile {
  id: string;
  variantId: string;
  provider: 'WORLDMOVE';
  regionCode: string;
  medium: 'ESIM' | 'PHYSICAL_SIM';
  dataPolicy: string;
  speedPolicy: string;
  networkPolicy?: string | null;
  activationPolicy?: string | null;
  resetPolicy?: string | null;
  operationType: string;
  durationDays: number;
  familyKey: string;
  status: 'ACTIVE' | 'INACTIVE' | 'REVOKED';
  source: string;
  version: number;
}

export interface FulfillmentProfilePreviewItem {
  variantId: string;
  sku?: string | null;
  durationDays?: number | null;
  activeProfile: FulfillmentProfile | null;
  evidenceSource?: string | null;
}

export interface FulfillmentProfilePreviewResponse {
  items: FulfillmentProfilePreviewItem[];
  generatedAt: string;
}
