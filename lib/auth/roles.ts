export const APP_ROLES = ["ADMIN", "STAFF"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_CAPABILITIES = [
  "VIEW_DASHBOARD",
  "MANAGE_PROPERTIES",
  "MANAGE_TENANTS",
  "MANAGE_PEOPLE",
  "MANAGE_CONTRACTS",
  "MANAGE_BILLING",
  "MANAGE_INVOICE_TEMPLATES",
  "MANAGE_CHARGES",
  "MANAGE_BACKLOG",
  "MANAGE_COSA",
  "MANAGE_UTILITIES",
  "MANAGE_METERS",
  "RECORD_READINGS",
] as const;

export type AppCapability = (typeof APP_CAPABILITIES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrator",
  STAFF: "Staff",
};

export const CAPABILITY_LABELS: Record<AppCapability, string> = {
  VIEW_DASHBOARD: "View dashboard",
  MANAGE_PROPERTIES: "Properties",
  MANAGE_TENANTS: "Tenants",
  MANAGE_PEOPLE: "People",
  MANAGE_CONTRACTS: "Contracts",
  MANAGE_BILLING: "Billing",
  MANAGE_INVOICE_TEMPLATES: "Invoice templates",
  MANAGE_CHARGES: "Charges",
  MANAGE_BACKLOG: "Backlog",
  MANAGE_COSA: "COSA",
  MANAGE_UTILITIES: "Utilities",
  MANAGE_METERS: "Meters",
  RECORD_READINGS: "Readings",
};

export const CAPABILITY_GROUPS = [
  {
    title: "Workspace",
    capabilities: [
      "VIEW_DASHBOARD",
      "MANAGE_PROPERTIES",
      "MANAGE_TENANTS",
      "MANAGE_PEOPLE",
    ],
  },
  {
    title: "Operations",
    capabilities: [
      "MANAGE_CONTRACTS",
      "MANAGE_BILLING",
      "MANAGE_INVOICE_TEMPLATES",
      "MANAGE_CHARGES",
      "MANAGE_BACKLOG",
      "MANAGE_COSA",
      "MANAGE_UTILITIES",
      "MANAGE_METERS",
      "RECORD_READINGS",
    ],
  },
] as const satisfies ReadonlyArray<{
  title: string;
  capabilities: readonly AppCapability[];
}>;

export const LEGACY_METER_READER_CAPABILITIES = [
  "VIEW_DASHBOARD",
  "MANAGE_UTILITIES",
  "MANAGE_METERS",
  "RECORD_READINGS",
] as const satisfies readonly AppCapability[];

type CapabilityUser = {
  role: AppRole;
  capabilities?: readonly AppCapability[] | AppCapability[] | null;
};

const ADMIN_DASHBOARD_CAPABILITIES: readonly AppCapability[] = [
  "MANAGE_PROPERTIES",
  "MANAGE_TENANTS",
  "MANAGE_PEOPLE",
  "MANAGE_CONTRACTS",
  "MANAGE_BILLING",
  "MANAGE_INVOICE_TEMPLATES",
  "MANAGE_CHARGES",
  "MANAGE_BACKLOG",
  "MANAGE_COSA",
];

export function isAdmin(user: Pick<CapabilityUser, "role">) {
  return user.role === "ADMIN";
}

export function hasCapability(user: CapabilityUser, capability: AppCapability) {
  return isAdmin(user) || (user.capabilities ?? []).includes(capability);
}

export function hasAnyCapability(
  user: CapabilityUser,
  capabilities: readonly AppCapability[]
) {
  return isAdmin(user) || capabilities.some((capability) => hasCapability(user, capability));
}

export function hasAllCapabilities(
  user: CapabilityUser,
  capabilities: readonly AppCapability[]
) {
  return isAdmin(user) || capabilities.every((capability) => hasCapability(user, capability));
}

export function usesAdminWorkspace(user: CapabilityUser) {
  return hasAnyCapability(user, ADMIN_DASHBOARD_CAPABILITIES);
}
