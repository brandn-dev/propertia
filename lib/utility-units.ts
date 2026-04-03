import { UTILITY_TYPES } from "@/lib/form-options";

type UtilityType = (typeof UTILITY_TYPES)[number];

const UTILITY_UNIT_LABELS: Record<UtilityType, string> = {
  ELECTRICITY: "kWh",
  WATER: "cu m",
  GAS: "cu m",
  SEWER: "cu m",
  OTHER: "units",
};

export function getUtilityUnitLabel(utilityType: UtilityType) {
  return UTILITY_UNIT_LABELS[utilityType];
}

export function getUtilityRateLabel(utilityType: UtilityType) {
  const unitLabel = getUtilityUnitLabel(utilityType);

  return unitLabel === "units" ? "Rate per unit" : `Rate per ${unitLabel}`;
}

export function getUtilityReadingLabel(utilityType: UtilityType) {
  const unitLabel = getUtilityUnitLabel(utilityType);

  return unitLabel === "units"
    ? "Current reading"
    : `Current reading (${unitLabel})`;
}

export function formatUtilityQuantity(
  utilityType: UtilityType,
  value: string | number
) {
  return `${value} ${getUtilityUnitLabel(utilityType)}`;
}
