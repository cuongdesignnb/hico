import type { CustomerOrder } from './customerOrder';

export interface CustomerDashboardSummary {
  customer: { displayName: string; email: string; phone: string | null };
  orders: { total: number; pending: number; completed: number; cancelled: number; totalsByCurrency: Record<string, number> };
  fulfillment: { pendingOrders: number; pendingItems: number };
  recentOrders: CustomerOrder[];
  capabilities: { assets: boolean; loyalty: boolean; notifications: boolean; support: boolean };
  generatedAt: string;
}
