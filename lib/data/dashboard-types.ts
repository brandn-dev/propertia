export type DashboardTrendPoint = {
  label: string;
  value: number;
};

export type DashboardRangePreset = "30D" | "60D" | "90D" | "12M" | "ALL";

export type DashboardSeriesByRange<TPoint> = Record<DashboardRangePreset, TPoint[]>;

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
  axisKey?: string;
  label: string;
  tooltipLabel?: string;
  billed: number;
  collected: number;
  outstanding: number;
};

export type DashboardUtilityChargesPoint = {
  axisKey?: string;
  label: string;
  tooltipLabel?: string;
  charges: number;
  readings: number;
};

export type DashboardPaidEarningsPoint = {
  axisKey?: string;
  label: string;
  tooltipLabel?: string;
  rent: number;
  charges: number;
  cosa: number;
  reading: number;
  paidRevenue: number;
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

export type DashboardInvoiceStatusSummary = {
  totalVisible: number;
  paid: number;
  open: number;
  byStatus: DashboardInvoiceStatusPoint[];
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
    collections: DashboardSeriesByRange<DashboardCollectionsPoint>;
    utilityCharges: DashboardSeriesByRange<DashboardUtilityChargesPoint>;
    paidEarnings: DashboardSeriesByRange<DashboardPaidEarningsPoint>;
  };
  breakdowns: {
    occupancyByBuilding: DashboardOccupancyPoint[];
    invoiceStatusSummary: DashboardInvoiceStatusSummary;
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
