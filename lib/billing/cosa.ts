import { ALLOCATION_TYPES } from "@/lib/form-options";

type AllocationType = (typeof ALLOCATION_TYPES)[number];

type CosaAllocationEntry = {
  contractId: string;
  basisValue?: number | null;
  percentage?: number | null;
  unitCount?: number | null;
  amount?: number | null;
};

type CalculatedCosaAllocation = {
  contractId: string;
  percentage: number;
  computedAmount: number;
};

function toCents(value: number) {
  return Math.round(value * 100);
}

function fromCents(value: number) {
  return Number((value / 100).toFixed(2));
}

function roundPercentage(value: number) {
  return Number(value.toFixed(2));
}

function buildPercentagesFromCents(amountsInCents: number[], totalInCents: number) {
  if (totalInCents <= 0) {
    return amountsInCents.map(() => 0);
  }

  let runningPercentage = 0;

  return amountsInCents.map((amountInCents, index) => {
    if (index === amountsInCents.length - 1) {
      return roundPercentage(100 - runningPercentage);
    }

    const percentage = roundPercentage((amountInCents / totalInCents) * 100);
    runningPercentage += percentage;
    return percentage;
  });
}

function distributeCentsByWeights(totalInCents: number, weights: number[]) {
  if (weights.length === 0) {
    return [];
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    throw new Error("Weights must be greater than zero.");
  }

  const weightedAmounts = weights.map((weight, index) => {
    const rawAmount = (totalInCents * weight) / totalWeight;

    return {
      index,
      cents: Math.floor(rawAmount),
      fraction: rawAmount - Math.floor(rawAmount),
    };
  });

  let distributedCents = weightedAmounts.reduce(
    (sum, weightedAmount) => sum + weightedAmount.cents,
    0
  );
  let remainingCents = totalInCents - distributedCents;

  weightedAmounts
    .slice()
    .sort((left, right) => right.fraction - left.fraction)
    .forEach((weightedAmount) => {
      if (remainingCents <= 0) {
        return;
      }

      weightedAmounts[weightedAmount.index].cents += 1;
      distributedCents += 1;
      remainingCents -= 1;
    });

  if (distributedCents !== totalInCents) {
    weightedAmounts[weightedAmounts.length - 1].cents += totalInCents - distributedCents;
  }

  return weightedAmounts
    .sort((left, right) => left.index - right.index)
    .map((weightedAmount) => weightedAmount.cents);
}

export function calculateCosaAllocations(params: {
  allocationType: AllocationType;
  totalAmount: number;
  entries: CosaAllocationEntry[];
}) {
  const { allocationType, entries, totalAmount } = params;
  const totalInCents = toCents(totalAmount);

  if (totalInCents < 0) {
    throw new Error("Total amount cannot be negative.");
  }

  if (entries.length === 0) {
    return [] as CalculatedCosaAllocation[];
  }

  let amountsInCents: number[];

  switch (allocationType) {
    case "EQUAL_SPLIT":
      amountsInCents = distributeCentsByWeights(
        totalInCents,
        entries.map(() => 1)
      );
      break;
    case "BY_AREA":
      amountsInCents = distributeCentsByWeights(
        totalInCents,
        entries.map((entry) => entry.basisValue ?? 0)
      );
      break;
    case "PERCENTAGE":
      amountsInCents = distributeCentsByWeights(
        totalInCents,
        entries.map((entry) => entry.percentage ?? 0)
      );
      break;
    case "PER_UNIT":
      amountsInCents = distributeCentsByWeights(
        totalInCents,
        entries.map((entry) => entry.unitCount ?? 0)
      );
      break;
    case "CUSTOM": {
      amountsInCents = entries.map((entry) => toCents(entry.amount ?? 0));
      const totalAllocatedInCents = amountsInCents.reduce(
        (sum, amountInCents) => sum + amountInCents,
        0
      );

      if (totalAllocatedInCents !== totalInCents) {
        throw new Error("Custom amounts must add up to the total amount.");
      }

      break;
    }
    default:
      amountsInCents = distributeCentsByWeights(
        totalInCents,
        entries.map(() => 1)
      );
      break;
  }

  const percentages = buildPercentagesFromCents(amountsInCents, totalInCents);

  return entries.map((entry, index) => ({
    contractId: entry.contractId,
    percentage: percentages[index] ?? 0,
    computedAmount: fromCents(amountsInCents[index] ?? 0),
  }));
}
