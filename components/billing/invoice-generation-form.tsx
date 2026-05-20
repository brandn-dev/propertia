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
  getUtilityBillingWindowForCycle,
  isReadingInUtilityBillingWindow,
} from "@/lib/billing/cycles";
import { getHistoricalBacklogCutoffDate } from "@/lib/billing/backlog";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import { formatLongDate } from "@/lib/format";
import { getUtilityUnitLabel } from "@/lib/utility-units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionRedirect } from "@/components/ui/use-action-redirect";
import { useActionToast } from "@/components/ui/toast-provider";

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
      id: string;
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
    readings: {
      id: string;
      readingDate: string;
      consumption: string;
      ratePerUnit: string;
      totalAmount: string;
      meter: {
        propertyId: string;
        meterCode: string;
        utilityType: keyof typeof UTILITY_TYPE_LABELS & (
          | "OTHER"
          | "ELECTRICITY"
          | "WATER"
          | "GAS"
          | "SEWER"
        );
      };
    }[];
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
  readingOptions: ReadingSelectionOption[];
};

type PendingTenantGroup = {
  id: string;
  label: string;
  contractCount: number;
  cycles: PendingCycleOption[];
};

type ReadingSelectionOption = {
  id: string;
  selectionKey: string;
  meterCode: string;
  utilityTypeLabel: string;
  readingDateLabel: string;
  serviceCoverageLabel: string;
  consumptionLabel: string;
  rateLabel: string;
  amountLabel: string;
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

function formatMoney(value: number) {
  return `₱${new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function InvoiceGenerationForm({
  formAction,
  contractOptions,
  initialValues,
}: InvoiceGenerationFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  useActionRedirect(state.redirectTo);
  useActionToast({
    message: state.message,
    title: "Invoice generation blocked",
    intent: "error",
  });
  const [selectedTenantId, setSelectedTenantId] = useState(initialValues.tenantId);
  const [selectedCycleKeysByTenant, setSelectedCycleKeysByTenant] = useState<
    Record<string, string[]>
  >({});
  const [selectedReadingKeysByCycle, setSelectedReadingKeysByCycle] = useState<
    Record<string, string[]>
  >({});
  const [issueDate, setIssueDate] = useState(initialValues.issueDate);
  const cutoffDate = getHistoricalBacklogCutoffDate();

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
        includeCurrentCycle: true,
        includeNextCycleInIssueMonth: true,
      });
      const visiblePendingCycles = filterCyclesWithoutInvoicedMonths(
        pendingCycles,
        new Set(
          contract.existingPeriods.map((period) =>
            getBillingMonthKey(new Date(period.start))
          )
        )
      ).filter((cycle) => cycle.end >= cutoffDate);

      return {
        ...contract,
        tenantLabel: formatTenantName(contract.tenant),
        pendingCycleOptions: visiblePendingCycles.map((cycle) => {
          const cycleSelectionKey = getInvoiceGenerationSelectionKey(
            contract.id,
            cycle.start,
            cycle.end
          );
          const utilityBillingWindow = getUtilityBillingWindowForCycle({
            anchorDate: new Date(contract.paymentAnchorDate),
            cycleStart: cycle.start,
            issueDate: issueDateValue,
          });
          const readingOptions = utilityBillingWindow
            ? contract.readings
                .filter((reading) => {
                  const readingDate = new Date(reading.readingDate);
                  return isReadingInUtilityBillingWindow(
                    readingDate,
                    utilityBillingWindow
                  );
                })
                .map((reading) => ({
                  id: reading.id,
                  selectionKey: `${cycleSelectionKey}::${reading.id}`,
                  meterCode: reading.meter.meterCode,
                  utilityTypeLabel: UTILITY_TYPE_LABELS[reading.meter.utilityType],
                  readingDateLabel: formatLongDate(reading.readingDate),
                  serviceCoverageLabel: `${formatLongDate(
                    utilityBillingWindow.serviceCycle.start
                  )} to ${formatLongDate(utilityBillingWindow.serviceCycle.end)}`,
                  consumptionLabel: `${Number(reading.consumption)} ${getUtilityUnitLabel(reading.meter.utilityType)}`,
                  rateLabel: `${formatMoney(Number(reading.ratePerUnit))} / ${getUtilityUnitLabel(reading.meter.utilityType)}`,
                  amountLabel: formatMoney(Number(reading.totalAmount)),
                }))
            : [];

          return {
            id: cycleSelectionKey,
            label: formatBillingCycleLabel(cycle),
            meta: `${contract.property.propertyCode} · ${contract.property.name}`,
            readingOptions,
          };
        }),
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
  const selectedVisibleCycles = visibleCycleLabels.filter((cycle) =>
    effectiveSelectedCycleKeys.includes(cycle.id)
  );
  const utilityReadingSelectionCount = selectedVisibleCycles.reduce(
    (sum, cycle) => {
      const effectiveReadingSelection =
        selectedReadingKeysByCycle[cycle.id] ??
        cycle.readingOptions.map((reading) => reading.selectionKey);
      return sum + effectiveReadingSelection.length;
    },
    0
  );

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

  function toggleReading(cycleId: string, readingSelectionKey: string) {
    const cycle = visibleCycleLabels.find((candidate) => candidate.id === cycleId);

    if (!cycle) {
      return;
    }

    setSelectedReadingKeysByCycle((current) => {
      const currentSelection =
        current[cycleId] ?? cycle.readingOptions.map((reading) => reading.selectionKey);

      return {
        ...current,
        [cycleId]: currentSelection.includes(readingSelectionKey)
          ? currentSelection.filter((key) => key !== readingSelectionKey)
          : [...currentSelection, readingSelectionKey],
      };
    });
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
                  months you want to issue. Connected-meter utility readings
                  appear under each selected cycle and stay preselected unless
                  you remove them.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.45rem] border border-border/60 bg-background/55 p-4">
            <p className="text-sm font-medium">What this run includes</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Base rent is added automatically from the contract cycle.</li>
              <li>Active recurring charges are added automatically when effective in that cycle.</li>
              <li>Dedicated-meter utility readings stay selectable under each cycle.</li>
              <li>Saved uninvoiced COSA allocations are included automatically when COSA billing date falls inside the selected cycle.</li>
            </ol>
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
              <p className="text-sm text-muted-foreground">
                Earlier historical months still move through backlog. May 2026 can
                generate here when still uninvoiced.
              </p>
              <FieldError message={state.errors?.readingSelections?.[0]} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="space-y-4 rounded-[1.2rem] border border-border/60 bg-background/45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Invoices to generate</p>
                    <p className="text-sm text-muted-foreground">
                      Check the billing months you want to issue for the selected
                      business, then keep or remove the utility readings under
                      each chosen cycle.
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
                      const effectiveReadingSelection =
                        selectedReadingKeysByCycle[cycle.id] ??
                        cycle.readingOptions.map(
                          (readingOption) => readingOption.selectionKey
                        );

                      return (
                        <div
                          key={cycle.id}
                          className={`rounded-[1rem] border px-4 py-3 transition-colors ${
                            isChecked
                              ? "border-primary/50 bg-primary/8"
                              : "border-border/60 bg-background/55 hover:bg-muted/30"
                          }`}
                        >
                          <label className="flex items-start gap-3">
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

                          {isChecked && cycle.readingOptions.length > 0 ? (
                            <div className="mt-3 space-y-2 rounded-[0.95rem] border border-border/60 bg-background/45 p-3">
                              <div className="space-y-1">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                  Utility readings
                                </p>
                                <p className="text-xs leading-5 text-muted-foreground">
                                  Connected dedicated-meter readings for this cycle. Uncheck any line you do not want to bill now.
                                </p>
                              </div>

                              <div className="space-y-2">
                                {cycle.readingOptions.map((reading) => {
                                  const isReadingChecked = effectiveReadingSelection.includes(
                                    reading.selectionKey
                                  );

                                  return (
                                    <label
                                      key={reading.selectionKey}
                                      className={`flex items-start gap-3 rounded-[0.9rem] border px-3 py-3 transition-colors ${
                                        isReadingChecked
                                          ? "border-primary/45 bg-primary/6"
                                          : "border-border/55 bg-background/60"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        name="readingSelections"
                                        value={reading.selectionKey}
                                        checked={isReadingChecked}
                                        onChange={() =>
                                          toggleReading(cycle.id, reading.selectionKey)
                                        }
                                        className="mt-1 size-4 rounded border border-border bg-background text-primary accent-primary"
                                      />
                                      <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-sm font-medium">
                                            {reading.utilityTypeLabel} · {reading.meterCode}
                                          </p>
                                          <p className="text-sm font-semibold">
                                            {reading.amountLabel}
                                          </p>
                                        </div>
                                        <p className="text-xs leading-5 text-muted-foreground">
                                          Reading date: {reading.readingDateLabel}
                                        </p>
                                        <p className="text-xs leading-5 text-muted-foreground">
                                          Service: {reading.serviceCoverageLabel}
                                        </p>
                                        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                          <p>Consumption: {reading.consumptionLabel}</p>
                                          <p>Rate: {reading.rateLabel}</p>
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
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
              uninvoiced COSA allocations, and whichever connected-meter
              utility readings you keep selected for the run. Rent adjustments
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
                  {utilityReadingSelectionCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {utilityReadingSelectionCount} utility reading(s) currently selected.
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
