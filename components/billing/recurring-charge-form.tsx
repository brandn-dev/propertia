"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import type { RecurringChargeFormState } from "@/app/(dashboard)/billing/actions";
import {
  RECURRING_CHARGE_TYPES,
  RECURRING_CHARGE_TYPE_LABELS,
} from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "field-blank flex h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50";

const initialState: RecurringChargeFormState = {};

type RecurringChargeFormProps = {
  mode: "create" | "edit";
  formAction: (
    state: RecurringChargeFormState,
    formData: FormData
  ) => Promise<RecurringChargeFormState>;
  contractOptions: {
    id: string;
    status: string;
    paymentStartDate: string;
    paymentAnchorLabel: string;
    property: {
      name: string;
      propertyCode: string;
    };
    tenant: {
      firstName: string | null;
      lastName: string | null;
      businessName: string | null;
    };
  }[];
  initialValues?: {
    contractId: string;
    chargeType: (typeof RECURRING_CHARGE_TYPES)[number];
    label: string;
    amount: string;
    effectiveStartDate: string;
    effectiveEndDate: string;
    isActive: boolean;
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function formatTenantName(
  tenant: RecurringChargeFormProps["contractOptions"][number]["tenant"]
) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

export function RecurringChargeForm({
  mode,
  formAction,
  contractOptions,
  initialValues = {
    contractId: "",
    chargeType: "INTERNET",
    label: "",
    amount: "",
    effectiveStartDate: "",
    effectiveEndDate: "",
    isActive: true,
  },
}: RecurringChargeFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const canSubmit = contractOptions.length > 0;

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-[1.85rem] p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contractId">Contract</Label>
              <select
                id="contractId"
                name="contractId"
                defaultValue={initialValues.contractId}
                className={selectClassName}
              >
                <option value="">Select a contract</option>
                {contractOptions.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.property.propertyCode} · {formatTenantName(contract.tenant)} ·
                    bills from {contract.paymentAnchorLabel}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.contractId?.[0]} />
              <p className="text-sm text-muted-foreground">
                Recurring charges follow the selected contract&apos;s billing
                anchor and are included once per completed cycle while active.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chargeType">Charge type</Label>
              <select
                id="chargeType"
                name="chargeType"
                defaultValue={initialValues.chargeType}
                className={selectClassName}
              >
                {RECURRING_CHARGE_TYPES.map((chargeType) => (
                  <option key={chargeType} value={chargeType}>
                    {RECURRING_CHARGE_TYPE_LABELS[chargeType]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.chargeType?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                name="label"
                defaultValue={initialValues.label}
                placeholder="Fiber internet"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.label?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Recurring amount</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.amount}
                placeholder="1500.00"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.amount?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveStartDate">Effective start</Label>
              <Input
                id="effectiveStartDate"
                name="effectiveStartDate"
                type="date"
                defaultValue={initialValues.effectiveStartDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.effectiveStartDate?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveEndDate">Effective end</Label>
              <Input
                id="effectiveEndDate"
                name="effectiveEndDate"
                type="date"
                defaultValue={initialValues.effectiveEndDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.effectiveEndDate?.[0]} />
            </div>

            <div className="md:col-span-2">
              <label className="field-blank flex items-start gap-3 rounded-[1.2rem] border bg-background/60 px-4 py-3">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={initialValues.isActive}
                  className="mt-1 size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Active recurring charge</span>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Active charges are included automatically in each completed
                    billing cycle that overlaps the charge&apos;s effective dates.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {state.message ? (
            <div className="rounded-[1.2rem] border border-border/70 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
              {state.message}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="border-blank rounded-[1.85rem] p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              {mode === "create" ? "New record" : "Update record"}
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {mode === "create" ? "Create recurring charge" : "Save recurring charge"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "create"
                ? "Attach a monthly recurring charge such as internet or parking to a contract so billing can add it automatically every cycle."
                : "Update recurring charge timing or amount without disturbing previously generated invoice items."}
            </p>

            {!canSubmit ? (
              <div className="mt-4 rounded-[1.2rem] border border-dashed border-border/80 bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
                Create at least one draft or active contract before adding a
                recurring charge.
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || !canSubmit}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                {mode === "create" ? "Create charge" : "Save changes"}
              </Button>
              <Button
                render={<Link href="/billing/charges" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to charges
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
