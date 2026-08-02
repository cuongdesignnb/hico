export type CheckoutEngine = 'legacy' | 'canonical';

export interface CheckoutItemRequest {
  variantId: string;
  quantity: number;
}

export interface CheckoutCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface CheckoutShipping {
  recipientName: string;
  phone: string;
  addressLine: string;
  ward: string;
  district: string;
  province: string;
  country: string;
}

export interface CheckoutValidationResponse {
  valid: boolean;
  currency?: 'VND' | 'USD';
  subtotal?: number;
  items?: Array<{ variantId: string; quantity: number; unitPrice: number; currency: 'VND' | 'USD'; productName: string }>;
  errors?: Array<{ code: string; message: string }>;
  warnings?: string[];
}
