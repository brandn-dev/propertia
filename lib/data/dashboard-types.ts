export type DashboardTrendPoint = {
  label: string;
  value: number;
};

export type AdminDashboardKpiKey =
  | "openInvoices"
  | "outstandingBalance"
  | "occupiedSpaces"
  | "contractsExpiringSoon";

export type AdminDashboardKpi = {
  key: AdminDashboardKpiKey;
  label: string;
  value: number;
  detail: string;
  trend: DashboardTrendPoint[];
};

export type DashboardCollectionsPoint = {
  label: string;
  billed: number;
  collected: number;
  outstanding: number;
};

export type DashboardUtilityChargesPoint = {
  label: string;
  charges: number;
  readings: number;
};

export type DashboardOccupancyPoint = {
  buildingId: string;
  buildingLabel: string;
  occupied: number;
  vacant: number;
  total: number;
  occupancyRate: number;
};

export type DashboardInvoiceStatusPoint = {
  status: "PAID" | "ISSUED" | "PARTIALLY_PAID" | "OVERDUE";
  label: string;
  value: number;
};

export type DashboardDueInvoice = {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  balanceDue: number;
  status: "ISSUED" | "PARTIALLY_PAID" | "OVERDUE";
  tenantName: string;
  propertyName: string;
};

export type DashboardExpiringContract = {
  id: string;
  endDate: string;
  monthlyRent: number;
  tenantName: string;
  propertyName: string;
};

export type DashboardReminder = {
  label: string;
  value: string;
  tone?: "default" | "warning" | "critical";
  detail?: string;
};

export type DashboardNearestBillable = {
  contractId: string;
  tenantName: string;
  propertyName: string;
  cycleStart: string;
  cycleEnd: string;
};

export type AdminDashboardData = {
  kpis: AdminDashboardKpi[];
  series: {
    collections: DashboardCollectionsPoint[];
    utilityCharges: DashboardUtilityChargesPoint[];
  };
  breakdowns: {
    occupancyByBuilding: DashboardOccupancyPoint[];
    invoiceStatusMix: DashboardInvoiceStatusPoint[];
  };
  queues: {
    dueSoon: DashboardDueInvoice[];
    expiringContracts: DashboardExpiringContract[];
  };
  reminders: {
    items: DashboardReminder[];
    nearestBillables: DashboardNearestBillable[];
  };
  summary: {
    openInvoices: number;
    outstandingBalance: number;
    occupiedSpaces: number;
    totalSpaces: number;
    contractsExpiringSoon: number;
  };
};
