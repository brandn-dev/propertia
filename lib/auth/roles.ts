export const APP_ROLES = ["ADMIN", "METER_READER"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrator",
  METER_READER: "Meter Reader",
};
