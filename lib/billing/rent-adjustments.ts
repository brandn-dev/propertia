import "server-only";

type RentAdjustmentInput = {
  effectiveDate: Date;
  increaseType: "FIXED" | "PERCENTAGE";
  increaseValue: { toString(): string } | number;
  calculationType: "SIMPLE" | "COMPOUND";
  basedOn: "BASE_RENT" | "PREVIOUS_RENT";
};

export type RentScheduleEditorRow =
  | {
      kind: "BASE";
      effectiveDate: Date;
      monthlyRent: number;
    }
  | {
      kind: "ADJUSTMENT";
      effectiveDate: Date;
      increaseType: "FIXED" | "PERCENTAGE";
      increaseValue: number;
      basedOn: "BASE_RENT" | "PREVIOUS_RENT";
      previewMonthlyRent: number;
    };

function toNumber(value: { toString(): string } | number) {
  return typeof value === "number" ? value : Number(value.toString());
}

export function calculateAdjustedMonthlyRent(params: {
  baseMonthlyRent: { toString(): string } | number;
  cycleStart: Date;
  adjustments: RentAdjustmentInput[];
}) {
  const baseRent = toNumber(params.baseMonthlyRent);
  let currentRent = baseRent;

  const applicableAdjustments = params.adjustments
    .filter((adjustment) => adjustment.effectiveDate <= params.cycleStart)
    .sort(
      (left, right) =>
        left.effectiveDate.getTime() - right.effectiveDate.getTime()
    );

  for (const adjustment of applicableAdjustments) {
    const increaseValue = toNumber(adjustment.increaseValue);
    const referenceRent =
      adjustment.basedOn === "BASE_RENT" ||
      adjustment.calculationType === "SIMPLE"
        ? baseRent
        : currentRent;

    const increaseAmount =
      adjustment.increaseType === "FIXED"
        ? increaseValue
        : referenceRent * (increaseValue / 100);

    currentRent += increaseAmount;
  }

  return Number(currentRent.toFixed(2));
}

export function buildRentScheduleRows(params: {
  contractStartDate: Date;
  baseMonthlyRent: { toString(): string } | number;
  adjustments: RentAdjustmentInput[];
}) {
  const baseRent = toNumber(params.baseMonthlyRent);
  let currentRent = baseRent;

  const rows: RentScheduleEditorRow[] = [
    {
      kind: "BASE",
      effectiveDate: params.contractStartDate,
      monthlyRent: Number(baseRent.toFixed(2)),
    },
  ];

  const sortedAdjustments = [...params.adjustments].sort(
    (left, right) => left.effectiveDate.getTime() - right.effectiveDate.getTime()
  );

  for (const adjustment of sortedAdjustments) {
    const increaseValue = toNumber(adjustment.increaseValue);
    const referenceRent =
      adjustment.basedOn === "BASE_RENT" ||
      adjustment.calculationType === "SIMPLE"
        ? baseRent
        : currentRent;

    const increaseAmount =
      adjustment.increaseType === "FIXED"
        ? increaseValue
        : referenceRent * (increaseValue / 100);

    currentRent = Number((currentRent + increaseAmount).toFixed(2));

    rows.push({
      kind: "ADJUSTMENT",
      effectiveDate: adjustment.effectiveDate,
      increaseType: adjustment.increaseType,
      increaseValue,
      basedOn:
        adjustment.calculationType === "SIMPLE"
          ? "BASE_RENT"
          : adjustment.basedOn,
      previewMonthlyRent: currentRent,
    });
  }

  return rows;
}
