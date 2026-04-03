"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import type { ContractFormState } from "@/app/(dashboard)/contracts/actions";
import {
  ADVANCE_RENT_APPLICATION_LABELS,
  ADVANCE_RENT_APPLICATIONS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
} from "@/lib/form-options";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClassName =
  "select-blank";

const initialState: ContractFormState = {};

type ContractFormProps = {
  mode: "create" | "edit";
  formAction: (
    state: ContractFormState,
    formData: FormData
  ) => Promise<ContractFormState>;
  propertyOptions: {
    id: string;
    name: string;
    propertyCode: string;
    status: string;
  }[];
  tenantOptions: {
    id: string;
    type: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  }[];
  initialValues?: {
    propertyId: string;
    tenantId: string;
    startDate: string;
    endDate: string;
    paymentStartDate: string;
    monthlyRent: string;
    advanceRentMonths: string;
    securityDepositMonths: string;
    freeRentCycles: string;
    advanceRentApplication: (typeof ADVANCE_RENT_APPLICATIONS)[number];
    status: (typeof CONTRACT_STATUSES)[number];
    notes: string;
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function formatTenantLabel(tenant: ContractFormProps["tenantOptions"][number]) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Unnamed tenant"
  );
}

function toMoneyValue(value: string) {
  const parsed = Number(value || "0");
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function ContractForm({
  mode,
  formAction,
  propertyOptions,
  tenantOptions,
  initialValues = {
    propertyId: "",
    tenantId: "",
    startDate: "",
    endDate: "",
    paymentStartDate: "",
    monthlyRent: "",
    advanceRentMonths: "0",
    securityDepositMonths: "0",
    freeRentCycles: "0",
    advanceRentApplication: "FIRST_BILLABLE_CYCLES",
    status: "DRAFT",
    notes: "",
  },
}: ContractFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const canSubmit = propertyOptions.length > 0 && tenantOptions.length > 0;
  const hasInitialBillingCycleOverride =
    Boolean(initialValues.paymentStartDate) &&
    Boolean(initialValues.startDate) &&
    initialValues.paymentStartDate !== initialValues.startDate;
  const [startDate, setStartDate] = useState(initialValues.startDate);
  const [isBillingCycleOverride, setIsBillingCycleOverride] = useState(
    hasInitialBillingCycleOverride
  );
  const [billingCycleStartDate, setBillingCycleStartDate] = useState(
    initialValues.paymentStartDate || initialValues.startDate
  );
  const [monthlyRent, setMonthlyRent] = useState(initialValues.monthlyRent);
  const [advanceRentMonths, setAdvanceRentMonths] = useState(
    initialValues.advanceRentMonths
  );
  const [securityDepositMonths, setSecurityDepositMonths] = useState(
    initialValues.securityDepositMonths
  );

  const monthlyRentValue = toMoneyValue(monthlyRent);
  const advanceRentPreview = monthlyRentValue * Number(advanceRentMonths || "0");
  const securityDepositPreview =
    monthlyRentValue * Number(securityDepositMonths || "0");

  const resolvedBillingCycleStartDate = isBillingCycleOverride
    ? billingCycleStartDate
    : startDate;

  function handleStartDateChange(value: string) {
    setStartDate(value);

    if (!isBillingCycleOverride) {
      setBillingCycleStartDate(value);
    }
  }

  function handleBillingCycleOverrideChange(nextChecked: boolean) {
    setIsBillingCycleOverride(nextChecked);

    if (!nextChecked) {
      setBillingCycleStartDate(startDate);
    } else if (!billingCycleStartDate) {
      setBillingCycleStartDate(startDate);
    }
  }

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="paymentStartDate"
        value={resolvedBillingCycleStartDate}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-xl p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="propertyId">Property</Label>
              <select
                id="propertyId"
                name="propertyId"
                defaultValue={initialValues.propertyId}
                className={selectClassName}
              >
                <option value="">Select a property</option>
                {propertyOptions.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name} ({property.propertyCode})
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.propertyId?.[0]} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tenantId">Tenant</Label>
              <select
                id="tenantId"
                name="tenantId"
                defaultValue={initialValues.tenantId}
                className={selectClassName}
              >
                <option value="">Select a tenant</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {formatTenantLabel(tenant)}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.tenantId?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                name="startDate"
                value={startDate}
                onChange={(event) => handleStartDateChange(event.target.value)}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.startDate?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={initialValues.endDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.endDate?.[0]} />
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="billingCycleOverride">Billing cycle start</Label>
                  <p className="text-xs text-muted-foreground">
                    Defaults to the contract start date unless you need a later
                    billing anchor.
                  </p>
                </div>

                <label
                  htmlFor="billingCycleOverride"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <input
                    id="billingCycleOverride"
                    type="checkbox"
                    checked={isBillingCycleOverride}
                    onChange={(event) =>
                      handleBillingCycleOverrideChange(event.target.checked)
                    }
                    className="size-4 rounded border border-input bg-transparent accent-primary"
                  />
                  Override
                </label>
              </div>

              {isBillingCycleOverride ? (
                <div className="space-y-2">
                  <Input
                    id="billingCycleStartDate"
                    type="date"
                    value={billingCycleStartDate}
                    onChange={(event) => setBillingCycleStartDate(event.target.value)}
                    className="field-blank h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Free-rent and advance-rent application both begin from this
                    billing cycle.
                  </p>
                  <FieldError message={state.errors?.paymentStartDate?.[0]} />
                </div>
              ) : (
                <div className="field-blank flex h-11 items-center rounded-lg px-3 text-sm text-muted-foreground">
                  {startDate || "Follows the contract start date"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={initialValues.status}
                className={selectClassName}
              >
                {CONTRACT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CONTRACT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.status?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyRent">Monthly rent</Label>
              <Input
                id="monthlyRent"
                name="monthlyRent"
                type="number"
                min="0"
                step="0.01"
                value={monthlyRent}
                onChange={(event) => setMonthlyRent(event.target.value)}
                placeholder="25000.00"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.monthlyRent?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="advanceRentMonths">Advance rent months</Label>
              <Input
                id="advanceRentMonths"
                name="advanceRentMonths"
                type="number"
                min="0"
                step="1"
                value={advanceRentMonths}
                onChange={(event) => setAdvanceRentMonths(event.target.value)}
                placeholder="0"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.advanceRentMonths?.[0]} />
              <p className="text-xs text-muted-foreground">
                Preview charge: {formatCurrency(advanceRentPreview)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="securityDepositMonths">Security deposit months</Label>
              <Input
                id="securityDepositMonths"
                name="securityDepositMonths"
                type="number"
                min="0"
                step="1"
                value={securityDepositMonths}
                onChange={(event) => setSecurityDepositMonths(event.target.value)}
                placeholder="0"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.securityDepositMonths?.[0]} />
              <p className="text-xs text-muted-foreground">
                Preview charge: {formatCurrency(securityDepositPreview)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="freeRentCycles">Free-rent cycles</Label>
              <Input
                id="freeRentCycles"
                name="freeRentCycles"
                type="number"
                min="0"
                step="1"
                defaultValue={initialValues.freeRentCycles}
                placeholder="0"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.freeRentCycles?.[0]} />
              <p className="text-xs text-muted-foreground">
                These cycles are waived first before any advance-rent credit is applied.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="advanceRentApplication">
                Advance rent application
              </Label>
              <select
                id="advanceRentApplication"
                name="advanceRentApplication"
                defaultValue={initialValues.advanceRentApplication}
                className={selectClassName}
              >
                {ADVANCE_RENT_APPLICATIONS.map((option) => (
                  <option key={option} value={option}>
                    {ADVANCE_RENT_APPLICATION_LABELS[option]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.advanceRentApplication?.[0]} />
              <p className="text-xs text-muted-foreground">
                Advance rent is billed once, then automatically applied after
                the free-rent cycles have been consumed.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={initialValues.notes}
                placeholder="Terms, escalation notes, or operational remarks."
                className="field-blank"
              />
              <FieldError message={state.errors?.notes?.[0]} />
            </div>
          </div>

          {state.message ? (
            <div className="rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
              {state.message}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              {mode === "create" ? "New record" : "Update record"}
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {mode === "create" ? "Create contract" : "Save contract changes"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "create"
                ? "Create an agreement linking a leasable property to a tenant with rent, dates, and billing cycle rules."
                : "Update the commercial terms of this agreement while preserving invoices, payments, and adjustment history."}
            </p>

            {!canSubmit ? (
              <div className="mt-4 rounded-[1.2rem] border border-dashed border-border/80 bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
                Create at least one leasable property and one tenant before you
                can save a contract.
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
                {mode === "create" ? "Create contract" : "Save changes"}
              </Button>
              <Button
                render={<Link href="/contracts" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to contracts
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
