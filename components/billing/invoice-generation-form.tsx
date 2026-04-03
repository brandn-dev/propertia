"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange, LoaderCircle, Save } from "lucide-react";
import type { InvoiceGenerationFormState } from "@/app/(dashboard)/billing/actions";
import {
  filterCyclesWithoutInvoicedMonths,
  findNextCompletedBillingCycles,
  formatBillingCycleLabel,
  getBillingCycleKey,
  getBillingMonthKey,
  getInvoiceGenerationSelectionKey,
} from "@/lib/billing/cycles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "select-blank";

const initialState: InvoiceGenerationFormState = {};

type InvoiceGenerationFormProps = {
  formAction: (
    state: InvoiceGenerationFormState,
    formData: FormData
  ) => Promise<InvoiceGenerationFormState>;
  contractOptions: {
    id: string;
    tenantId: string;
    paymentAnchorDate: string;
    contractEndDate: string;
    existingPeriods: {
      start: string;
      end: string;
    }[];
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
    rentAdjustmentCount: number;
    pendingCycleLabels: string[];
  }[];
  initialValues: {
    tenantId: string;
    issueDate: string;
    dueDate: string;
  };
};

type PendingCycleOption = {
  id: string;
  label: string;
  meta: string;
};

type PendingTenantGroup = {
  id: string;
  label: string;
  contractCount: number;
  cycles: PendingCycleOption[];
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
  const [selectedTenantId, setSelectedTenantId] = useState(initialValues.tenantId);
  const [selectedCycleKeysByTenant, setSelectedCycleKeysByTenant] = useState<
    Record<string, string[]>
  >({});
  const [issueDate, setIssueDate] = useState(initialValues.issueDate);

  const issueDateValue = issueDate
    ? new Date(`${issueDate}T23:59:59.999`)
    : new Date();

  const pendingContracts = contractOptions
    .map((contract) => {
      const pendingCycles = findNextCompletedBillingCycles({
        anchorDate: new Date(contract.paymentAnchorDate),
        contractEndDate: new Date(contract.contractEndDate),
        issueDate: issueDateValue,
        existingPeriods: new Set(
          contract.existingPeriods.map((period) =>
            getBillingCycleKey(new Date(period.start), new Date(period.end))
          )
        ),
      });
      const visiblePendingCycles = filterCyclesWithoutInvoicedMonths(
        pendingCycles,
        new Set(
          contract.existingPeriods.map((period) =>
            getBillingMonthKey(new Date(period.start))
          )
        )
      );

      return {
        ...contract,
        tenantLabel: formatTenantName(contract.tenant),
        pendingCycleOptions: visiblePendingCycles.map((cycle) => ({
          id: getInvoiceGenerationSelectionKey(contract.id, cycle.start, cycle.end),
          label: formatBillingCycleLabel(cycle),
          meta: `${contract.property.propertyCode} · ${contract.property.name}`,
        })),
      };
    })
    .filter((contract) => contract.pendingCycleOptions.length > 0);

  const tenantGroupsMap = new Map<string, PendingTenantGroup>();

  for (const contract of pendingContracts) {
    const existingGroup = tenantGroupsMap.get(contract.tenantId);

    if (existingGroup) {
      existingGroup.contractCount += 1;
      existingGroup.cycles.push(...contract.pendingCycleOptions);
      continue;
    }

    tenantGroupsMap.set(contract.tenantId, {
      id: contract.tenantId,
      label: contract.tenantLabel,
      contractCount: 1,
      cycles: [...contract.pendingCycleOptions],
    });
  }

  const tenantGroups = Array.from(tenantGroupsMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  const currentTenantId = tenantGroups.some(
    (tenant) => tenant.id === selectedTenantId
  )
    ? selectedTenantId
    : tenantGroups[0]?.id ?? "";
  const currentTenant =
    tenantGroups.find((tenant) => tenant.id === currentTenantId) ?? null;
  const visibleCycleLabels = currentTenant?.cycles ?? [];
  const effectiveSelectedCycleKeys = currentTenant
    ? (
        selectedCycleKeysByTenant[currentTenantId] ??
        currentTenant.cycles.map((cycle) => cycle.id)
      ).filter((cycleId) => visibleCycleLabels.some((cycle) => cycle.id === cycleId))
    : [];

  function handleTenantChange(nextTenantId: string) {
    setSelectedTenantId(nextTenantId);
  }

  function toggleCycle(cycleId: string) {
    if (!currentTenant) {
      return;
    }

    setSelectedCycleKeysByTenant((current) => {
      const currentSelection =
        current[currentTenantId] ?? currentTenant.cycles.map((cycle) => cycle.id);

      return {
        ...current,
        [currentTenantId]: currentSelection.includes(cycleId)
          ? currentSelection.filter((id) => id !== cycleId)
          : [...currentSelection, cycleId],
      };
    });
  }

  function selectAllVisibleCycles() {
    if (!currentTenant) {
      return;
    }

    setSelectedCycleKeysByTenant((current) => ({
      ...current,
      [currentTenantId]: visibleCycleLabels.map((cycle) => cycle.id),
    }));
  }

  function clearSelectedCycles() {
    if (!currentTenant) {
      return;
    }

    setSelectedCycleKeysByTenant((current) => ({
      ...current,
      [currentTenantId]: [],
    }));
  }

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-xl p-6">
          <div className="rounded-[1.45rem] border border-border/60 bg-background/55 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
                <CalendarRange className="size-4.5" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Cycle billing is automatic</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Billing periods are derived from each contract&apos;s billing
                  anchor. Pick the business first, then check only the invoice
                  months you want to issue for that business.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tenantId">Business scope</Label>
              <select
                id="tenantId"
                name="tenantId"
                value={currentTenantId}
                onChange={(event) => handleTenantChange(event.target.value)}
                className={selectClassName}
                disabled={tenantGroups.length === 0}
              >
                {tenantGroups.length === 0 ? (
                  <option value="">No eligible businesses</option>
                ) : (
                  tenantGroups.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.label} · {tenant.cycles.length} invoice(s)
                    </option>
                  ))
                )}
              </select>
              <FieldError message={state.errors?.tenantId?.[0]} />
              <p className="text-sm text-muted-foreground">
                Businesses only appear here when they have completed uninvoiced
                billing months ready for issuance.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="space-y-4 rounded-[1.2rem] border border-border/60 bg-background/45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Invoices to generate</p>
                    <p className="text-sm text-muted-foreground">
                      Check the billing months you want to issue for the selected
                      business.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="button-blank h-9 rounded-lg px-3"
                      onClick={selectAllVisibleCycles}
                      disabled={!currentTenant}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="button-blank h-9 rounded-lg px-3"
                      onClick={clearSelectedCycles}
                      disabled={!currentTenant}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {!currentTenant ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    No eligible invoice cycles are available for the selected
                    issue date.
                  </p>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {visibleCycleLabels.map((cycle) => {
                      const isChecked = effectiveSelectedCycleKeys.includes(
                        cycle.id
                      );

                      return (
                        <label
                          key={cycle.id}
                          className={`flex items-start gap-3 rounded-[1rem] border px-4 py-3 transition-colors ${
                            isChecked
                              ? "border-primary/50 bg-primary/8"
                              : "border-border/60 bg-background/55 hover:bg-muted/30"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="cycleSelections"
                            value={cycle.id}
                            checked={isChecked}
                            onChange={() => toggleCycle(cycle.id)}
                            className="mt-1 size-4 rounded border border-border bg-background text-primary accent-primary"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium">{cycle.label}</p>
                            <p className="text-sm leading-6 text-muted-foreground">
                              {cycle.meta}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <FieldError message={state.errors?.cycleSelections?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue date</Label>
              <Input
                id="issueDate"
                name="issueDate"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
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
            <div className="rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
              {state.message}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              Issue run
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Generate invoices
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Each cycle includes base rent, active recurring charges, any
              uninvoiced COSA allocations, and tenant-dedicated utility
              readings captured inside that billing window. Rent adjustments
              effective before the cycle start are applied automatically.
            </p>

            <div className="mt-5 rounded-[1.2rem] border border-dashed border-border/75 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
              Previously invoiced months and already-linked readings are skipped
              automatically. Only one invoice per contract per month is allowed.
            </div>

            <div className="mt-5 space-y-3 rounded-[1.2rem] border border-border/60 bg-background/60 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Selected invoices in this run</p>
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {effectiveSelectedCycleKeys.length} cycle(s)
                </span>
              </div>

              {!currentTenant ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  No eligible businesses are available for this issue date.
                </p>
              ) : effectiveSelectedCycleKeys.length === 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  Select one or more invoice cycles to preview the issue run.
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleCycleLabels
                    .filter((cycle) => effectiveSelectedCycleKeys.includes(cycle.id))
                    .slice(0, 8)
                    .map((cycle) => (
                      <div
                        key={cycle.id}
                        className="rounded-lg border border-border/60 bg-muted/35 px-3 py-2 text-sm"
                      >
                        <p className="font-medium">{cycle.label}</p>
                        <p className="text-xs text-muted-foreground">{cycle.meta}</p>
                      </div>
                    ))}
                  {effectiveSelectedCycleKeys.length > 8 ? (
                    <p className="text-xs text-muted-foreground">
                      {effectiveSelectedCycleKeys.length - 8} more cycle(s) will
                      also be generated.
                    </p>
                  ) : null}
                </div>
              )}
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
