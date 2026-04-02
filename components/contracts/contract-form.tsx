"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import type { ContractFormState } from "@/app/(dashboard)/contracts/actions";
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
} from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClassName =
  "field-blank flex h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50";

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
    advanceRent: string;
    securityDeposit: string;
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
    advanceRent: "0",
    securityDeposit: "0",
    status: "DRAFT",
    notes: "",
  },
}: ContractFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const canSubmit = propertyOptions.length > 0 && tenantOptions.length > 0;

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-[1.85rem] p-6">
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
                name="startDate"
                type="date"
                defaultValue={initialValues.startDate}
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

            <div className="space-y-2">
              <Label htmlFor="paymentStartDate">Payment start</Label>
              <Input
                id="paymentStartDate"
                name="paymentStartDate"
                type="date"
                defaultValue={initialValues.paymentStartDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.paymentStartDate?.[0]} />
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
                defaultValue={initialValues.monthlyRent}
                placeholder="25000.00"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.monthlyRent?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="advanceRent">Advance rent</Label>
              <Input
                id="advanceRent"
                name="advanceRent"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.advanceRent}
                placeholder="0.00"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.advanceRent?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="securityDeposit">Security deposit</Label>
              <Input
                id="securityDeposit"
                name="securityDeposit"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.securityDeposit}
                placeholder="0.00"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.securityDeposit?.[0]} />
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
              {mode === "create" ? "Create contract" : "Save contract changes"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "create"
                ? "Create an agreement linking a leasable property to a tenant with rent, dates, and billing start rules."
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
