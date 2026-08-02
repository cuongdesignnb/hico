export interface CustomerProfile {
  customerId: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  displayName: string;
  locale: string | null;
  timezone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  recipientName: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  ward: string | null;
  district: string | null;
  city: string;
  countryCode: string;
  postalCode: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSession {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  lastAuthenticatedAt: string | null;
  expiresAt: string;
}

export interface CustomerSecurityEvent { id: string; type: string; requestId: string | null; createdAt: string; }
export interface CustomerSecurityEventList { items: CustomerSecurityEvent[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number }; }
