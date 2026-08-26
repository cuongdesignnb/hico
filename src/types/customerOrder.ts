export type CustomerOrderStatus = 'PENDING' | 'PROCESSING' | 'PROVISIONED' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | string;

export interface CustomerOrderItem {
  productName: string;
  productId: string | null;
  variantId: string | null;
  sku: string | null;
  operation: string | null;
  requestedTripDays?: number;
  tripDayOptions?: number[];
  quantity: number;
  unitPrice: number;
  currency: string;
}

export interface CustomerOrder {
  orderId: string;
  createdAt: string | null;
  status: CustomerOrderStatus;
  currency: string;
  subtotal: number;
  totalsByCurrency: Record<string, number>;
  items: CustomerOrderItem[];
  shipping: { recipientName: string | null; phone: string | null; city: string | null } | null;
  fulfillment: { status: CustomerOrderStatus; pending: boolean; completed: boolean; cancelled: boolean; sensitiveAssetsAvailable: false };
  nextAction: string;
}

export interface CustomerOrderPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CustomerOrdersResponse {
  items: CustomerOrder[];
  pagination: CustomerOrderPagination;
}
