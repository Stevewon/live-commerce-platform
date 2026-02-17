// Type definitions for the Live Commerce Platform

export type UserRole = 'ADMIN' | 'PARTNER' | 'CUSTOMER';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalPartners?: number;
  pendingOrders?: number;
  revenueGrowth?: number;
}

export interface PartnerStats {
  totalSales: number;
  totalOrders: number;
  pendingSettlement: number;
  completedSettlement: number;
  activeProducts: number;
  conversionRate?: number;
}

export interface RevenueShare {
  orderId: string;
  orderNumber: string;
  total: number;
  partnerRevenue: number;
  platformRevenue: number;
  commissionRate: number;
  status: string;
  createdAt: Date;
}
