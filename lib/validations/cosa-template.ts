import { z } from "zod";
import { ALLOCATION_TYPES } from "@/lib/form-options";

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
  contractId: z.string().trim().min(1, "Select at least one tenant contract."),
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
    const uniqueContractIds = new Set(value.allocations.map((allocation) => allocation.contractId));

    if (uniqueContractIds.size !== value.allocations.length) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Each tenant contract can only be selected once.",
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
