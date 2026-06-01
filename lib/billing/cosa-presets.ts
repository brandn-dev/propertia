import type { ALLOCATION_TYPES, UTILITY_TYPES } from "@/lib/form-options";

export const COSA_TEMPLATE_PRESET_IDS = [
  "common-water",
  "common-electricity",
  "security-guard",
  "maintenance-staff",
  "generator-fuel",
] as const;

export type CosaTemplatePresetId = (typeof COSA_TEMPLATE_PRESET_IDS)[number];

export type CosaTemplatePreset = {
  id: CosaTemplatePresetId;
  label: string;
  name: string;
  allocationType: (typeof ALLOCATION_TYPES)[number];
  utilityType?: (typeof UTILITY_TYPES)[number];
  description: string;
  sourceHint: string;
};

export const COSA_TEMPLATE_PRESETS: CosaTemplatePreset[] = [
  {
    id: "common-water",
    label: "Common Water",
    name: "Common Water",
    allocationType: "PERCENTAGE",
    utilityType: "WATER",
    description:
      "Use this for the shared water meter, then split the monthly total by tenant percentage.",
    sourceHint: "Shared meter + percentage",
  },
  {
    id: "common-electricity",
    label: "Common Electricity",
    name: "Common Electricity",
    allocationType: "PERCENTAGE",
    utilityType: "ELECTRICITY",
    description:
      "Use this for the shared electric meter, then split the monthly total by tenant percentage.",
    sourceHint: "Shared meter + percentage",
  },
  {
    id: "security-guard",
    label: "Security Guard",
    name: "Security Guard Salary",
    allocationType: "PER_UNIT",
    description:
      "Use this for the monthly guard salary, then divide it by the participating tenant unit counts.",
    sourceHint: "Manual amount + by unit",
  },
  {
    id: "maintenance-staff",
    label: "Maintenance Staff",
    name: "Maintenance Staff Salary",
    allocationType: "PER_UNIT",
    description:
      "Use this for the monthly maintenance payroll, then divide it by the participating tenant unit counts.",
    sourceHint: "Manual amount + by unit",
  },
  {
    id: "generator-fuel",
    label: "Generator Fuel",
    name: "Generator Fuel",
    allocationType: "PER_UNIT",
    description:
      "Use this for the monthly generator fuel cost, then choose the participating tenants and adjust the split mode if needed.",
    sourceHint: "Manual amount + flexible split",
  },
];

export function getCosaTemplatePreset(presetId?: string | null) {
  return COSA_TEMPLATE_PRESETS.find((preset) => preset.id === presetId) ?? null;
}
