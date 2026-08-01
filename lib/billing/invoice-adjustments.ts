export const INVOICE_ADJUSTMENT_TYPES = ["ADDITION", "DEDUCTION"] as const;
export const INVOICE_ADJUSTMENT_VALUE_TYPES = ["FIXED", "PERCENTAGE"] as const;
export const WHOLE_INVOICE_TARGET = "__invoice__";

export type InvoiceAdjustmentType = (typeof INVOICE_ADJUSTMENT_TYPES)[number];
export type InvoiceAdjustmentValueType =
  (typeof INVOICE_ADJUSTMENT_VALUE_TYPES)[number];

export type InvoiceAdjustmentInput = {
  id: string;
  cycleSelectionKey: string;
  adjustmentType: InvoiceAdjustmentType;
  valueType: InvoiceAdjustmentValueType;
  value: number;
  targetLineId: string;
  label: string;
};

export function calculateInvoiceAdjustmentAmount(params: {
  valueType: InvoiceAdjustmentValueType;
  value: number;
  basisAmount: number;
}) {
  const rawAmount =
    params.valueType === "PERCENTAGE"
      ? params.basisAmount * (params.value / 100)
      : params.value;

  return Number(rawAmount.toFixed(2));
}
