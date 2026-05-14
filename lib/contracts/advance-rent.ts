import { ADVANCE_RENT_APPLICATIONS } from "@/lib/form-options";

export type AdvanceRentApplication = (typeof ADVANCE_RENT_APPLICATIONS)[number];

function toWholeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export function deriveWholeMonths(amount: number, baseRent: number) {
  if (amount <= 0 || baseRent <= 0) {
    return 0;
  }

  const ratio = amount / baseRent;
  const rounded = Math.round(ratio);

  return Math.abs(ratio - rounded) < 0.01 ? rounded : 0;
}

export function resolveAdvanceRentPlacement(params: {
  advanceRentMonths: number;
  advanceRentApplication: AdvanceRentApplication;
  advanceRentFirstMonths?: number | null;
  advanceRentLastMonths?: number | null;
}) {
  const totalMonths = toWholeNumber(params.advanceRentMonths);
  const storedFirstMonths = toWholeNumber(params.advanceRentFirstMonths);
  const storedLastMonths = toWholeNumber(params.advanceRentLastMonths);
  const normalizedFirstMonths = Math.min(totalMonths, storedFirstMonths);
  const normalizedLastMonths = Math.min(
    Math.max(0, totalMonths - normalizedFirstMonths),
    storedLastMonths
  );

  if (params.advanceRentApplication === "SPLIT_FIRST_AND_LAST_CYCLES") {
    return {
      firstMonths: normalizedFirstMonths,
      lastMonths: normalizedLastMonths,
      assignedMonths: normalizedFirstMonths + normalizedLastMonths,
    };
  }

  if (params.advanceRentApplication === "LAST_BILLABLE_CYCLES") {
    return {
      firstMonths: 0,
      lastMonths: totalMonths,
      assignedMonths: totalMonths,
    };
  }

  return {
    firstMonths: totalMonths,
    lastMonths: 0,
    assignedMonths: totalMonths,
  };
}

export function buildAdvanceApplicationCycleIndexes(params: {
  totalCycles: number;
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication: AdvanceRentApplication;
  advanceRentFirstMonths?: number | null;
  advanceRentLastMonths?: number | null;
}) {
  const billableCycleIndexes = Array.from(
    { length: params.totalCycles },
    (_, index) => index
  ).filter((index) => index >= params.freeRentCycles);
  const placement = resolveAdvanceRentPlacement(params);
  const firstIndexes = billableCycleIndexes.slice(0, placement.firstMonths);
  const reservedIndexes = new Set(firstIndexes);
  const remainingBillableIndexes = billableCycleIndexes.filter(
    (index) => !reservedIndexes.has(index)
  );
  const lastIndexes =
    placement.lastMonths > 0
      ? remainingBillableIndexes.slice(-placement.lastMonths)
      : [];

  return new Set([...firstIndexes, ...lastIndexes]);
}
