import {
  INVOICE_GENERATION_ADJUSTMENT_ACTIONS,
  INVOICE_GENERATION_ADJUSTMENT_VALUE_TYPES,
} from "@/lib/form-options";

export type InvoiceGenerationAdjustmentAction =
  (typeof INVOICE_GENERATION_ADJUSTMENT_ACTIONS)[number];
export type InvoiceGenerationAdjustmentValueType =
  (typeof INVOICE_GENERATION_ADJUSTMENT_VALUE_TYPES)[number];

export type InvoiceGenerationBillableLineType =
  | "RENT"
  | "RECURRING_CHARGE"
  | "UTILITY_READING"
  | "COSA";

export type InvoiceGenerationLineAdjustment = {
  cycleSelectionKey: string;
  lineId: string;
  action: InvoiceGenerationAdjustmentAction;
  valueType: InvoiceGenerationAdjustmentValueType;
  value: number;
};

export type InvoiceGenerationCarryForwardSelection = {
  cycleSelectionKey: string;
  carryForwardKey: string;
};

export type InvoiceGenerationLinePreview = {
  lineId: string;
  cycleSelectionKey: string;
  contractId: string;
  type: InvoiceGenerationBillableLineType;
  label: string;
  description: string;
  amount: number;
};

export type InvoiceGenerationSelectedCycle = {
  cycleSelectionKey: string;
  contractId: string;
  start: Date;
  end: Date;
};

export type InvoiceGenerationCarryForwardSource = {
  carryForwardKey: string;
  contractId: string;
  availableAfter: Date;
  amount: number;
  sourceLabel: string;
};

export type InvoiceGenerationLineOutcome = {
  billedAmount: number;
  reductionAmount: number;
  discountAmount: number;
  deferredAmount: number;
};

const LINE_ID_SEPARATOR = "::line::";
const CARRY_FORWARD_KEY_SEPARATOR = ":";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function buildInvoiceGenerationLineId(params: {
  cycleSelectionKey: string;
  lineType: "rent" | "recurring" | "reading" | "cosa";
  sourceId?: string;
}) {
  return [
    params.cycleSelectionKey,
    "line",
    params.lineType,
    params.sourceId ?? "base",
  ].join(LINE_ID_SEPARATOR);
}

export function buildPersistedCarryForwardKey(deferredBalanceId: string) {
  return ["persisted", deferredBalanceId].join(CARRY_FORWARD_KEY_SEPARATOR);
}

export function buildSyntheticCarryForwardKey(sourceLineId: string) {
  return ["synthetic", sourceLineId].join(CARRY_FORWARD_KEY_SEPARATOR);
}

export function parseCarryForwardKey(value: string) {
  const [kind, identifier] = value.split(CARRY_FORWARD_KEY_SEPARATOR);

  if (
    (kind !== "persisted" && kind !== "synthetic") ||
    !identifier ||
    value.split(CARRY_FORWARD_KEY_SEPARATOR).length !== 2
  ) {
    return null;
  }

  return {
    kind,
    identifier,
  } as const;
}

export function calculateInvoiceGenerationLineOutcome(params: {
  lineAmount: number;
  adjustment?: InvoiceGenerationLineAdjustment | null;
}): InvoiceGenerationLineOutcome {
  const originalAmount = roundMoney(params.lineAmount);
  const adjustment = params.adjustment;

  if (!adjustment || adjustment.action === "FULL") {
    return {
      billedAmount: originalAmount,
      reductionAmount: 0,
      discountAmount: 0,
      deferredAmount: 0,
    };
  }

  const reductionAmount =
    adjustment.valueType === "PERCENT"
      ? roundMoney(originalAmount * (adjustment.value / 100))
      : roundMoney(adjustment.value);
  const boundedReductionAmount = roundMoney(
    Math.min(Math.max(reductionAmount, 0), originalAmount)
  );

  return {
    billedAmount: roundMoney(originalAmount - boundedReductionAmount),
    reductionAmount: boundedReductionAmount,
    discountAmount: adjustment.action === "DISCOUNT" ? boundedReductionAmount : 0,
    deferredAmount: adjustment.action === "DEFER" ? boundedReductionAmount : 0,
  };
}

export function buildCarryForwardAssignments(params: {
  selectedCycles: InvoiceGenerationSelectedCycle[];
  sources: InvoiceGenerationCarryForwardSource[];
}) {
  const assignments = new Map<string, InvoiceGenerationCarryForwardSource[]>();
  const sortedCycles = [...params.selectedCycles].sort((left, right) => {
    if (left.start.getTime() !== right.start.getTime()) {
      return left.start.getTime() - right.start.getTime();
    }

    return left.cycleSelectionKey.localeCompare(right.cycleSelectionKey);
  });

  for (const source of params.sources) {
    const targetCycle = sortedCycles.find(
      (cycle) =>
        cycle.contractId === source.contractId &&
        cycle.start.getTime() > source.availableAfter.getTime()
    );

    if (!targetCycle) {
      continue;
    }

    const cycleAssignments = assignments.get(targetCycle.cycleSelectionKey) ?? [];
    cycleAssignments.push(source);
    assignments.set(targetCycle.cycleSelectionKey, cycleAssignments);
  }

  return assignments;
}
