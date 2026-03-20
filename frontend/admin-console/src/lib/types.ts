// API Response wrapper types
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    code?: string;
  };
}

// Audit Log types
export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, any>;
  changes?: Record<string, { before: any; after: any }>;
}

export interface AuditLogsResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

// Dashboard types
export interface DashboardMetric {
  value: number;
  label: string;
  trend?: number;
  unit?: string;
}

export interface ExecutiveDashboard {
  activeSubscribers: DashboardMetric;
  monthlyRevenue: DashboardMetric;
  pendingInstallations: DashboardMetric;
  supportTickets: DashboardMetric;
}

export interface BillingDashboard {
  overview: Record<string, any>;
  invoices: Array<Record<string, any>>;
  payments: Array<Record<string, any>>;
  ledger: Array<Record<string, any>>;
}

export interface NetworkDashboard {
  overview: Record<string, any>;
  nodes: Array<Record<string, any>>;
  devices: Array<Record<string, any>>;
}
