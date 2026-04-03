import { z } from "zod";
import { ALLOCATION_TYPES } from "@/lib/form-options";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function isValidMoney(value: string) {
  return !Number.isNaN(Number(value)) && Number(value) >= 0;
}

function isValidPercentage(value: string) {
  return !Number.isNaN(Number(value)) && Number(value) >= 0;
}

function isValidUnitCount(value: string) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

export const cosaAllocationInputSchema = z.object({
  contractId: z.string().trim().min(1, "Select at least one tenant contract."),
  percentage: z.string().trim().optional(),
  unitCount: z.string().trim().optional(),
  amount: z.string().trim().optional(),
});

export const cosaSchema = z
  .object({
    propertyId: z.string().trim().min(1, "Property is required."),
    meterId: z
      .string()
      .trim()
      .transform((value) => value || undefined),
    meterReadingId: z
      .string()
      .trim()
      .transform((value) => value || undefined),
    description: z
      .string()
      .trim()
      .min(1, "Description is required.")
      .max(160, "Description must be 160 characters or fewer."),
    totalAmount: z
      .string()
      .trim()
      .min(1, "Total amount is required.")
      .refine(
        (value) => isValidMoney(value) && Number(value) > 0,
        "Total amount must be greater than zero."
      ),
    billingDate: z
      .string()
      .trim()
      .min(1, "Billing date is required.")
      .refine(isValidDate, "Enter a valid billing date."),
    allocationType: z.enum(ALLOCATION_TYPES),
    allocations: z
      .array(cosaAllocationInputSchema)
      .min(1, "Select at least one tenant contract."),
  })
  .superRefine((value, ctx) => {
    if (value.meterReadingId && !value.meterId) {
      ctx.addIssue({
        code: "custom",
        path: ["meterReadingId"],
        message: "Select a shared meter before applying one of its readings.",
      });
    }

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

    if (value.allocationType === "CUSTOM") {
      const totalAllocatedAmount = value.allocations.reduce((sum, allocation, index) => {
        const amount = allocation.amount ?? "";

        if (!isValidMoney(amount)) {
          ctx.addIssue({
            code: "custom",
            path: ["allocations", index, "amount"],
            message: "Enter a valid custom amount.",
          });
          return sum;
        }

        return sum + Number(amount);
      }, 0);

      if (Math.abs(totalAllocatedAmount - Number(value.totalAmount)) > 0.01) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations"],
          message: "Custom allocations must add up to the total amount.",
        });
      }
    }
  });

export type CosaInput = z.infer<typeof cosaSchema>;
