import { z } from "zod";
import { ALLOCATION_TYPES, COSA_CALCULATION_MODES } from "@/lib/form-options";

function isValidMoney(value: string) {
  return value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0);
}

function isValidPercentage(value: string) {
  return !Number.isNaN(Number(value)) && Number(value) >= 0;
}

function isValidUnitCount(value: string) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

export const cosaTemplateAllocationInputSchema = z.object({
  entryId: z.string().trim().min(1, "Allocation entry is invalid."),
  contractId: z.string().trim().optional(),
  helperLabel: z.string().trim().max(80, "Helper label must be 80 characters or fewer.").optional(),
  percentage: z.string().trim().optional(),
  unitCount: z.string().trim().optional(),
  amount: z.string().trim().optional(),
});

export const cosaTemplateSchema = z
  .object({
    propertyId: z.string().trim().min(1, "Property is required."),
    meterId: z
      .string()
      .trim()
      .transform((value) => value || undefined),
    name: z
      .string()
      .trim()
      .min(1, "Template name is required.")
      .max(120, "Template name must be 120 characters or fewer."),
    allocationType: z.enum(ALLOCATION_TYPES),
    calculationMode: z.enum(COSA_CALCULATION_MODES),
    dailyRate: z.string().trim().optional(),
    defaultAmount: z
      .string()
      .trim()
      .refine(isValidMoney, "Default amount must be a valid non-negative number.")
      .transform((value) => value || undefined),
    isActive: z.boolean(),
    allocations: z
      .array(cosaTemplateAllocationInputSchema)
      .min(1, "Select at least one tenant contract."),
  })
  .superRefine((value, ctx) => {
    if (value.calculationMode === "METER_READING" && !value.meterId) {
      ctx.addIssue({ code: "custom", path: ["meterId"], message: "Meter-reading templates require a shared meter." });
    }
    if (value.calculationMode === "DAILY_RATE") {
      if (value.meterId) {
        ctx.addIssue({ code: "custom", path: ["meterId"], message: "Daily-rate templates cannot be linked to a meter." });
      }
      if (!value.dailyRate || !isValidMoney(value.dailyRate) || Number(value.dailyRate) <= 0) {
        ctx.addIssue({ code: "custom", path: ["dailyRate"], message: "Enter a daily rate greater than zero." });
      }
    }
    const uniqueEntryIds = new Set(value.allocations.map((allocation) => allocation.entryId));
    const contractAllocations = value.allocations.filter(
      (allocation) => Boolean(allocation.contractId)
    );
    const helperAllocations = value.allocations.filter(
      (allocation) => !allocation.contractId
    );

    if (uniqueEntryIds.size !== value.allocations.length) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "One or more allocation entries are duplicated.",
      });
    }

    if (contractAllocations.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Select at least one tenant contract.",
      });
    }

    const uniqueContractIds = new Set(
      contractAllocations.map((allocation) => allocation.contractId)
    );

    if (uniqueContractIds.size !== contractAllocations.length) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Each tenant contract can only be selected once.",
      });
    }

    for (const [index, allocation] of value.allocations.entries()) {
      if (!allocation.contractId && !(allocation.helperLabel ?? "").trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations", index, "helperLabel"],
          message: "Enter a label for each helper row.",
        });
      }
    }

    if (
      helperAllocations.length > 0 &&
      value.allocationType !== "PERCENTAGE" &&
      value.allocationType !== "PER_UNIT"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Helper rows are only available for percentage or unit splits.",
      });
    }

    if (value.allocationType === "PERCENTAGE") {
      const totalPercentage = value.allocations.reduce((sum, allocation, index) => {
        const percentage = allocation.percentage ?? "";

        if (!isValidPercentage(percentage)) {
          ctx.addIssue({
            code: "custom",
            path: ["allocations", index, "percentage"],
            message: "Enter a valid percentage share.",
          });
          return sum;
        }

        return sum + Number(percentage);
      }, 0);

      if (Math.abs(totalPercentage - 100) > 0.01) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations"],
          message: "Percentage shares must add up to 100%.",
        });
      }
    }

    if (value.allocationType === "PER_UNIT") {
      const totalUnits = value.allocations.reduce((sum, allocation, index) => {
        const unitCount = allocation.unitCount ?? "";

        if (!isValidUnitCount(unitCount)) {
          ctx.addIssue({
            code: "custom",
            path: ["allocations", index, "unitCount"],
            message: "Enter a whole-number unit count greater than zero.",
          });
          return sum;
        }

        return sum + Number(unitCount);
      }, 0);

      if (totalUnits <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations"],
          message: "Add at least one unit across the selected tenant contracts.",
        });
      }
    }

    if (value.allocationType === "CUSTOM" && value.defaultAmount) {
      const totalAllocatedAmount = value.allocations.reduce((sum, allocation, index) => {
        const amount = allocation.amount ?? "";

        if (!isValidMoney(amount) || amount === "") {
          ctx.addIssue({
            code: "custom",
            path: ["allocations", index, "amount"],
            message: "Enter a valid custom amount.",
          });
          return sum;
        }

        return sum + Number(amount);
      }, 0);

      if (Math.abs(totalAllocatedAmount - Number(value.defaultAmount)) > 0.01) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations"],
          message: "Custom default allocations must add up to the default amount.",
        });
      }
    }

    if (value.allocationType === "CUSTOM" && !value.defaultAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultAmount"],
        message: "Custom-amount templates require a default monthly amount.",
      });
    }
  });

export type CosaTemplateInput = z.infer<typeof cosaTemplateSchema>;
