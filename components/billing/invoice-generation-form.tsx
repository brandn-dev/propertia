"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange, LoaderCircle, Save } from "lucide-react";
import type { InvoiceGenerationFormState } from "@/app/(dashboard)/billing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "field-blank flex h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50";

const initialState: InvoiceGenerationFormState = {};

type InvoiceGenerationFormProps = {
  formAction: (
    state: InvoiceGenerationFormState,
    formData: FormData
  ) => Promise<InvoiceGenerationFormState>;
  contractOptions: {
    id: string;
    property: {
      name: string;
      propertyCode: string;
    };
    tenant: {
      firstName: string | null;
      lastName: string | null;
      businessName: string | null;
    };
    paymentAnchorLabel: string;
    recurringChargeCount: number;
  }[];
  initialValues: {
    contractId: string;
    issueDate: string;
    dueDate: string;
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function formatTenantName(
  tenant: InvoiceGenerationFormProps["contractOptions"][number]["tenant"]
) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

export function InvoiceGenerationForm({
  formAction,
  contractOptions,
  initialValues,
}: InvoiceGenerationFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-[1.85rem] p-6">
          <div className="rounded-[1.45rem] border border-border/70 bg-background/55 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
                <CalendarRange className="size-4.5" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Cycle billing is automatic</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Billing periods are derived from each contract&apos;s payment
                  start date. A contract anchored on October 10 bills October 10
                  to November 9, then November 10 to December 9, and so on.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contractId">Contract scope</Label>
              <select
                id="contractId"
                name="contractId"
                defaultValue={initialValues.contractId}
                className={selectClassName}
              >
                <option value="">All eligible active contracts</option>
                {contractOptions.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.property.propertyCode} · {formatTenantName(contract.tenant)} ·
                    bills from {contract.paymentAnchorLabel}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.contractId?.[0]} />
              <p className="text-sm text-muted-foreground">
                Leave this blank to generate every completed uninvoiced cycle
                across all active contracts.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue date</Label>
              <Input
                id="issueDate"
                name="issueDate"
                type="date"
                defaultValue={initialValues.issueDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.issueDate?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={initialValues.dueDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.dueDate?.[0]} />
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
              Issue run
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Generate invoices
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Each cycle includes base rent, active recurring charges, and any
              uninvoiced tenant-dedicated utility readings captured inside that
              billing window.
            </p>

            <div className="mt-5 rounded-[1.2rem] border border-dashed border-border/75 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
              Previously invoiced cycles and already-linked meter readings are
              skipped automatically.
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                Generate invoices
              </Button>
              <Button
                render={<Link href="/billing" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to billing
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
