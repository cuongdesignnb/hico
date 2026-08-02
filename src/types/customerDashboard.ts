import type { CustomerOrder } from './customerOrder';

export interface CustomerDashboardSummary {
  customer: { displayName: string; email: string; phone: string | null };
  orders: { total: number; pending: number; completed: number; cancelled: number; totalsByCurrency: Record<string, number> };
  fulfillment: { pendingOrders: number; pendingItems: number };
  recentOrders: CustomerOrder[];
  capabilities: { assets: boolean; loyalty: boolean; notifications: boolean; referrals: boolean; support: boolean };
  assetSummary: {
    esims: { total: number; active: number; pending: number };
    physicalSims: { total: number; pendingShip: number; shipped: number };
    devices: { total: number };
    topups: { total: number; pending: number; completed: number };
    available: { esims: boolean; physicalSims: boolean; devices: boolean; topups: boolean };
  };
  loyaltySummary: { available: boolean; balance?: number };
  notificationsSummary: { available: boolean; unreadCount?: number };
  referralSummary: { available: boolean };
  generatedAt: string;
}
