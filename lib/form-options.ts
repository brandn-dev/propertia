export const PROPERTY_OWNERSHIP_TYPES = ["OWNED", "LEASED"] as const;
export const PROPERTY_CATEGORIES = [
  "BUILDING",
  "UNIT",
  "LAND",
  "COMMERCIAL_SPACE",
  "OTHER",
] as const;
export const PROPERTY_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "UNDER_MAINTENANCE",
  "ARCHIVED",
] as const;
export const TENANT_TYPES = ["INDIVIDUAL", "BUSINESS"] as const;
export const RECURRING_CHARGE_TYPES = [
  "INTERNET",
  "PARKING",
  "ASSOCIATION_DUES",
  "MAINTENANCE",
  "OTHER",
] as const;
export const CONTRACT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "ENDED",
  "TERMINATED",
  "EXPIRED",
] as const;
export const ADVANCE_RENT_APPLICATIONS = [
  "FIRST_BILLABLE_CYCLES",
  "LAST_BILLABLE_CYCLES",
] as const;
export const INCREASE_TYPES = ["FIXED", "PERCENTAGE"] as const;
export const RENT_CALCULATION_TYPES = ["SIMPLE", "COMPOUND"] as const;
export const RENT_BASE_OPTIONS = ["BASE_RENT", "PREVIOUS_RENT"] as const;
export const UTILITY_TYPES = [
  "ELECTRICITY",
  "WATER",
  "GAS",
  "SEWER",
  "OTHER",
] as const;
export const ALLOCATION_TYPES = [
  "PERCENTAGE",
  "PER_UNIT",
  "EQUAL_SPLIT",
  "BY_AREA",
  "CUSTOM",
] as const;
export const BACKLOG_PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export const BACKLOG_ADJUSTMENT_TYPES = ["ADJUSTMENT", "ARREARS"] as const;
export const INVOICE_ORIGINS = ["GENERATED", "BACKLOG"] as const;
export const METER_READING_ORIGINS = ["OPERATIONAL", "BACKLOG"] as const;

export const PROPERTY_OWNERSHIP_TYPE_LABELS = {
  OWNED: "Owned",
  LEASED: "Leased",
} as const;

export const PROPERTY_CATEGORY_LABELS = {
  BUILDING: "Building",
  UNIT: "Unit",
  LAND: "Land",
  COMMERCIAL_SPACE: "Commercial Space",
  OTHER: "Other",
} as const;

export const PROPERTY_STATUS_LABELS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  UNDER_MAINTENANCE: "Under Maintenance",
  ARCHIVED: "Archived",
} as const;

export const TENANT_TYPE_LABELS = {
  INDIVIDUAL: "Individual",
  BUSINESS: "Business",
} as const;

export const RECURRING_CHARGE_TYPE_LABELS = {
  INTERNET: "Internet",
  PARKING: "Parking",
  ASSOCIATION_DUES: "Association Dues",
  MAINTENANCE: "Maintenance",
  OTHER: "Other",
} as const;

export const CONTRACT_STATUS_LABELS = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ENDED: "Ended",
  TERMINATED: "Terminated",
  EXPIRED: "Expired",
} as const;

export const ADVANCE_RENT_APPLICATION_LABELS = {
  FIRST_BILLABLE_CYCLES: "Apply to first billable cycles after free rent",
  LAST_BILLABLE_CYCLES: "Apply to last billable cycles",
} as const;

export const INCREASE_TYPE_LABELS = {
  FIXED: "Fixed amount",
  PERCENTAGE: "Percentage",
} as const;

export const RENT_CALCULATION_TYPE_LABELS = {
  SIMPLE: "Simple",
  COMPOUND: "Compound",
} as const;

export const RENT_BASE_OPTION_LABELS = {
  BASE_RENT: "Base rent",
  PREVIOUS_RENT: "Previous adjusted rent",
} as const;

export const UTILITY_TYPE_LABELS = {
  ELECTRICITY: "Electricity",
  WATER: "Water",
  GAS: "Gas",
  SEWER: "Sewer",
  OTHER: "Other",
} as const;

export const ALLOCATION_TYPE_LABELS = {
  PERCENTAGE: "Percentage",
  PER_UNIT: "By unit",
  EQUAL_SPLIT: "Equal split",
  BY_AREA: "By area",
  CUSTOM: "Custom amount",
} as const;

export const BACKLOG_PAYMENT_STATUS_LABELS = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially paid",
  PAID: "Paid in full",
} as const;

export const BACKLOG_ADJUSTMENT_TYPE_LABELS = {
  ADJUSTMENT: "Adjustment",
  ARREARS: "Arrears",
} as const;

export const INVOICE_ORIGIN_LABELS = {
  GENERATED: "Generated",
  BACKLOG: "Backlog",
} as const;

export const METER_READING_ORIGIN_LABELS = {
  OPERATIONAL: "Operational",
  BACKLOG: "Backlog",
} as const;
