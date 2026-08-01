"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import type { InvoiceGenerationFormState } from "@/app/(dashboard)/billing/actions";
import {
  buildCarryForwardAssignments,
  buildInvoiceGenerationLineId,
  buildPersistedCarryForwardKey,
  buildSyntheticCarryForwardKey,
  calculateInvoiceGenerationLineOutcome,
  type InvoiceGenerationAdjustmentAction,
  type InvoiceGenerationAdjustmentValueType,
  type InvoiceGenerationBillableLineType,
  type InvoiceGenerationCarryForwardSource,
  type InvoiceGenerationLinePreview,
} from "@/lib/billing/invoice-generation-adjustments";
import {
  cycleOverlapsRange,
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
import { calculateAdjustedMonthlyRent } from "@/lib/billing/rent-adjustments";
import {
  calculateInvoiceAdjustmentAmount,
  WHOLE_INVOICE_TARGET,
  type InvoiceAdjustmentType,
  type InvoiceAdjustmentValueType,
} from "@/lib/billing/invoice-adjustments";
import {
  ALLOCATION_TYPE_LABELS,
  INVOICE_GENERATION_ADJUSTMENT_ACTION_LABELS,
  INVOICE_GENERATION_ADJUSTMENT_VALUE_TYPE_LABELS,
  RECURRING_CHARGE_TYPE_LABELS,
  UTILITY_TYPE_LABELS,
} from "@/lib/form-options";
import { dateInputToAppEndOfDay, formatLongDate } from "@/lib/format";
import { getUtilityUnitLabel } from "@/lib/utility-units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/ui/toast-provider";

const selectClassName = "select-blank";
const initialState: InvoiceGenerationFormState = {};

type InvoiceGenerationFormProps = {
  formAction: (
    state: InvoiceGenerationFormState,
    formData: FormData
  ) => Promise<InvoiceGenerationFormState>;
  contractOptions: {
    id: string;
    tenantId: string;
    monthlyRent: string;
    paymentAnchorDate: string;
    contractEndDate: string;
    rentAdjustments: {
      effectiveDate: string;
      increaseType: "FIXED" | "PERCENTAGE";
      increaseValue: string;
      calculationType: "SIMPLE" | "COMPOUND";
      basedOn: "BASE_RENT" | "PREVIOUS_RENT";
    }[];
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
    recurringCharges: {
      id: string;
      chargeType: keyof typeof RECURRING_CHARGE_TYPE_LABELS;
      label: string;
      amount: string;
      effectiveStartDate: string;
      effectiveEndDate: string | null;
    }[];
    cosaAllocations: {
      id: string;
      percentage: string;
      unitCount: number | null;
      computedAmount: string;
      cosa: {
        id: string;
        description: string;
        billingDate: string;
        allocationType: keyof typeof ALLOCATION_TYPE_LABELS;
      };
    }[];
    deferredBalances: {
      id: string;
      sourceDescription: string;
      sourceItemType: InvoiceGenerationBillableLineType | "ADJUSTMENT" | "ARREARS";
      deferredAmount: string;
      sourceInvoiceNumber: string;
      sourceBillingPeriodStart: string;
      sourceBillingPeriodEnd: string;
    }[];
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

type LineAdjustmentDraft = {
  action: InvoiceGenerationAdjustmentAction;
  valueType: InvoiceGenerationAdjustmentValueType;
  value: string;
};

type InvoiceAdjustmentDraft = {
  id: string;
  adjustmentType: InvoiceAdjustmentType;
  valueType: InvoiceAdjustmentValueType;
  value: string;
  targetLineId: string;
  label: string;
};

type DeferredBalancePreviewOption = {
  carryForwardKey: string;
  amount: number;
  amountLabel: string;
  sourceDescription: string;
  sourceInvoiceNumber: string;
  sourceBillingPeriodStart: string;
  sourceBillingPeriodEnd: string;
};

type PendingCycleOption = {
  id: string;
  contractId: string;
  label: string;
  meta: string;
  cycleStart: string;
  cycleEnd: string;
  rentLine: InvoiceGenerationLinePreview;
  readingOptions: Array<
    InvoiceGenerationLinePreview & {
      id: string;
      selectionKey: string;
      meterCode: string;
      utilityTypeLabel: string;
      readingDateLabel: string;
      serviceCoverageLabel: string;
      consumptionLabel: string;
      rateLabel: string;
      amountLabel: string;
    }
  >;
  recurringChargeOptions: Array<
    InvoiceGenerationLinePreview & {
      id: string;
      chargeTypeLabel: string;
      amountLabel: string;
      effectiveLabel: string;
    }
  >;
  cosaOptions: Array<
    InvoiceGenerationLinePreview & {
      id: string;
      billingDateLabel: string;
      allocationTypeLabel: string;
      basisLabel: string;
      amountLabel: string;
    }
  >;
  deferredBalanceOptions: DeferredBalancePreviewOption[];
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

function formatMoney(value: number) {
  return `₱${new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatAllocationBasisLabel(
  allocation: InvoiceGenerationFormProps["contractOptions"][number]["cosaAllocations"][number]
) {
  if (
    allocation.cosa.allocationType === "PER_UNIT" &&
    allocation.unitCount != null
  ) {
    return `${allocation.unitCount} unit${allocation.unitCount === 1 ? "" : "s"}`;
  }

  if (allocation.cosa.allocationType === "PERCENTAGE") {
    return `${Number(allocation.percentage)}%`;
  }

  return ALLOCATION_TYPE_LABELS[allocation.cosa.allocationType];
}

export function InvoiceGenerationForm({
  formAction,
  contractOptions,
  initialValues,
}: InvoiceGenerationFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
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
  const [lineAdjustmentDraftsByCycle, setLineAdjustmentDraftsByCycle] = useState<
    Record<string, Record<string, LineAdjustmentDraft>>
  >({});
  const [invoiceAdjustmentDraftsByCycle, setInvoiceAdjustmentDraftsByCycle] =
    useState<Record<string, InvoiceAdjustmentDraft[]>>({});
  const [carryForwardEnabledByCycle, setCarryForwardEnabledByCycle] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [issueDate, setIssueDate] = useState(initialValues.issueDate);
  const cutoffDate = getHistoricalBacklogCutoffDate();

  const issueDateValue = issueDate ? dateInputToAppEndOfDay(issueDate) : new Date();

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
          const rentAmount = calculateAdjustedMonthlyRent({
            baseMonthlyRent: Number(contract.monthlyRent),
            cycleStart: cycle.start,
            adjustments: contract.rentAdjustments.map((adjustment) => ({
              effectiveDate: new Date(adjustment.effectiveDate),
              increaseType: adjustment.increaseType,
              increaseValue: Number(adjustment.increaseValue),
              calculationType: adjustment.calculationType,
              basedOn: adjustment.basedOn,
            })),
          });
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
                  lineId: buildInvoiceGenerationLineId({
                    cycleSelectionKey,
                    lineType: "reading",
                    sourceId: reading.id,
                  }),
                  cycleSelectionKey,
                  contractId: contract.id,
                  type: "UTILITY_READING" as const,
                  label: `${UTILITY_TYPE_LABELS[reading.meter.utilityType]} · ${reading.meter.meterCode}`,
                  description: `${UTILITY_TYPE_LABELS[reading.meter.utilityType]} reading`,
                  amount: Number(reading.totalAmount),
                  selectionKey: `${cycleSelectionKey}::${reading.id}`,
                  meterCode: reading.meter.meterCode,
                  utilityTypeLabel: UTILITY_TYPE_LABELS[reading.meter.utilityType],
                  readingDateLabel: formatLongDate(reading.readingDate),
                  serviceCoverageLabel: `${formatLongDate(
                    utilityBillingWindow.serviceCycle.start
                  )} to ${formatLongDate(
                    utilityBillingWindow.serviceCycle.end
                  )}`,
                  consumptionLabel: `${Number(reading.consumption)} ${getUtilityUnitLabel(reading.meter.utilityType)}`,
                  rateLabel: `${formatMoney(Number(reading.ratePerUnit))} / ${getUtilityUnitLabel(reading.meter.utilityType)}`,
                  amountLabel: formatMoney(Number(reading.totalAmount)),
                }))
            : [];
          const recurringChargeOptions = contract.recurringCharges
            .filter((charge) =>
              cycleOverlapsRange(
                cycle,
                new Date(charge.effectiveStartDate),
                charge.effectiveEndDate ? new Date(charge.effectiveEndDate) : null
              )
            )
            .map((charge) => ({
              id: charge.id,
              lineId: buildInvoiceGenerationLineId({
                cycleSelectionKey,
                lineType: "recurring",
                sourceId: charge.id,
              }),
              cycleSelectionKey,
              contractId: contract.id,
              type: "RECURRING_CHARGE" as const,
              label: charge.label,
              description: `${charge.label} charge`,
              amount: Number(charge.amount),
              chargeTypeLabel: RECURRING_CHARGE_TYPE_LABELS[charge.chargeType],
              amountLabel: formatMoney(Number(charge.amount)),
              effectiveLabel: `Effective ${formatLongDate(charge.effectiveStartDate)}${
                charge.effectiveEndDate
                  ? ` to ${formatLongDate(charge.effectiveEndDate)}`
                  : " onward"
              }`,
            }));
          const cosaOptions = contract.cosaAllocations
            .filter((allocation) => {
              const billingDate = new Date(allocation.cosa.billingDate);
              return (
                billingDate <= issueDateValue &&
                billingDate >= cycle.start &&
                billingDate <= cycle.end
              );
            })
            .map((allocation) => ({
              id: allocation.id,
              lineId: buildInvoiceGenerationLineId({
                cycleSelectionKey,
                lineType: "cosa",
                sourceId: allocation.id,
              }),
              cycleSelectionKey,
              contractId: contract.id,
              type: "COSA" as const,
              label: allocation.cosa.description,
              description: allocation.cosa.description,
              amount: Number(allocation.computedAmount),
              billingDateLabel: formatLongDate(allocation.cosa.billingDate),
              allocationTypeLabel:
                ALLOCATION_TYPE_LABELS[allocation.cosa.allocationType],
              basisLabel: formatAllocationBasisLabel(allocation),
              amountLabel: formatMoney(Number(allocation.computedAmount)),
            }));

          return {
            id: cycleSelectionKey,
            contractId: contract.id,
            label: formatBillingCycleLabel(cycle),
            meta: `${contract.property.propertyCode} · ${contract.property.name}`,
            cycleStart: cycle.start.toISOString(),
            cycleEnd: cycle.end.toISOString(),
            rentLine: {
              lineId: buildInvoiceGenerationLineId({
                cycleSelectionKey,
                lineType: "rent",
              }),
              cycleSelectionKey,
              contractId: contract.id,
              type: "RENT" as const,
              label: "Rent",
              description: `Rent for ${formatBillingCycleLabel(cycle)}`,
              amount: rentAmount,
            },
            readingOptions,
            recurringChargeOptions,
            cosaOptions,
            deferredBalanceOptions: contract.deferredBalances.map((balance) => ({
              carryForwardKey: buildPersistedCarryForwardKey(balance.id),
              amount: Number(balance.deferredAmount),
              amountLabel: formatMoney(Number(balance.deferredAmount)),
              sourceDescription: balance.sourceDescription,
              sourceInvoiceNumber: balance.sourceInvoiceNumber,
              sourceBillingPeriodStart: balance.sourceBillingPeriodStart,
              sourceBillingPeriodEnd: balance.sourceBillingPeriodEnd,
            })),
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

  const tenantGroups = Array.from(tenantGroupsMap.values())
    .map((tenant) => ({
      ...tenant,
      cycles: [...tenant.cycles].sort((left, right) => {
        if (left.cycleStart !== right.cycleStart) {
          return left.cycleStart.localeCompare(right.cycleStart);
        }

        return left.meta.localeCompare(right.meta);
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const currentTenantId = tenantGroups.some(
    (tenant) => tenant.id === selectedTenantId
  )
    ? selectedTenantId
    : tenantGroups[0]?.id ?? "";
  const currentTenant =
    tenantGroups.find((tenant) => tenant.id === currentTenantId) ?? null;
  const visibleCycles = currentTenant?.cycles ?? [];
  const effectiveSelectedCycleKeys = currentTenant
    ? (
        selectedCycleKeysByTenant[currentTenantId] ??
        currentTenant.cycles.map((cycle) => cycle.id)
      ).filter((cycleId) => visibleCycles.some((cycle) => cycle.id === cycleId))
    : [];

  function getEffectiveReadingSelection(cycle: PendingCycleOption) {
    return (
      selectedReadingKeysByCycle[cycle.id] ??
      cycle.readingOptions.map((reading) => reading.selectionKey)
    ).filter((selectionKey) =>
      cycle.readingOptions.some((reading) => reading.selectionKey === selectionKey)
    );
  }

  function getBillableLines(cycle: PendingCycleOption) {
    const selectedReadingKeys = new Set(getEffectiveReadingSelection(cycle));

    return [
      cycle.rentLine,
      ...cycle.recurringChargeOptions,
      ...cycle.readingOptions.filter((reading) =>
        selectedReadingKeys.has(reading.selectionKey)
      ),
      ...cycle.cosaOptions,
    ] satisfies InvoiceGenerationLinePreview[];
  }

  function getLineAdjustmentDraft(
    cycleId: string,
    lineId: string
  ): LineAdjustmentDraft {
    return (
      lineAdjustmentDraftsByCycle[cycleId]?.[lineId] ?? {
        action: "FULL",
        valueType: "FIXED",
        value: "",
      }
    );
  }

  function getLineOutcome(cycleId: string, line: InvoiceGenerationLinePreview) {
    const draft = getLineAdjustmentDraft(cycleId, line.lineId);

    return calculateInvoiceGenerationLineOutcome({
      lineAmount: line.amount,
      adjustment:
        draft.action === "FULL"
          ? null
          : {
              cycleSelectionKey: cycleId,
              lineId: line.lineId,
              action: draft.action,
              valueType: draft.valueType,
              value: Number(draft.value || 0),
            },
    });
  }

  const selectedVisibleCycles = visibleCycles.filter((cycle) =>
    effectiveSelectedCycleKeys.includes(cycle.id)
  );
  const selectedCyclesForAssignments = selectedVisibleCycles.map((cycle) => ({
    cycleSelectionKey: cycle.id,
    contractId: cycle.contractId,
    start: new Date(cycle.cycleStart),
    end: new Date(cycle.cycleEnd),
  }));
  const persistedCarryForwardSources = Array.from(
    new Map(
      visibleCycles.flatMap((cycle) =>
        cycle.deferredBalanceOptions.map((balance) => [
          balance.carryForwardKey,
          {
            carryForwardKey: balance.carryForwardKey,
            contractId: cycle.contractId,
            availableAfter: new Date(balance.sourceBillingPeriodEnd),
            amount: balance.amount,
            sourceLabel: `${balance.sourceDescription} · ${balance.sourceInvoiceNumber}`,
          } satisfies InvoiceGenerationCarryForwardSource,
        ])
      )
    ).values()
  );
  const syntheticCarryForwardSources = selectedVisibleCycles.flatMap((cycle) =>
    getBillableLines(cycle).flatMap((line) => {
      const outcome = getLineOutcome(cycle.id, line);

      if (outcome.deferredAmount <= 0) {
        return [];
      }

      return [
        {
          carryForwardKey: buildSyntheticCarryForwardKey(line.lineId),
          contractId: cycle.contractId,
          availableAfter: new Date(cycle.cycleEnd),
          amount: outcome.deferredAmount,
          sourceLabel: `${line.label} · ${cycle.label}`,
        } satisfies InvoiceGenerationCarryForwardSource,
      ];
    })
  );
  const carryForwardAssignments = buildCarryForwardAssignments({
    selectedCycles: selectedCyclesForAssignments,
    sources: [...persistedCarryForwardSources, ...syntheticCarryForwardSources],
  });

  function getAssignedCarryForwards(cycleId: string) {
    return carryForwardAssignments.get(cycleId) ?? [];
  }

  function isCarryForwardEnabled(cycleId: string, carryForwardKey: string) {
    return carryForwardEnabledByCycle[cycleId]?.[carryForwardKey] ?? true;
  }

  const utilityReadingSelectionCount = selectedVisibleCycles.reduce(
    (sum, cycle) => sum + getEffectiveReadingSelection(cycle).length,
    0
  );
  const selectedRecurringChargeCount = selectedVisibleCycles.reduce(
    (sum, cycle) => sum + cycle.recurringChargeOptions.length,
    0
  );
  const selectedCosaCount = selectedVisibleCycles.reduce(
    (sum, cycle) => sum + cycle.cosaOptions.length,
    0
  );
  const selectedAdjustmentCount = selectedVisibleCycles.reduce(
    (sum, cycle) =>
      sum +
      getBillableLines(cycle).filter(
        (line) => getLineAdjustmentDraft(cycle.id, line.lineId).action !== "FULL"
      ).length,
    0
  );
  const selectedInvoiceAdjustmentCount = selectedVisibleCycles.reduce(
    (sum, cycle) => sum + (invoiceAdjustmentDraftsByCycle[cycle.id]?.length ?? 0),
    0
  );
  const selectedCarryForwardCount = selectedVisibleCycles.reduce(
    (sum, cycle) =>
      sum +
      getAssignedCarryForwards(cycle.id).filter((source) =>
        isCarryForwardEnabled(cycle.id, source.carryForwardKey)
      ).length,
    0
  );

  const serializedLineAdjustments = JSON.stringify(
    selectedVisibleCycles.flatMap((cycle) =>
      getBillableLines(cycle)
        .map((line) => {
          const draft = getLineAdjustmentDraft(cycle.id, line.lineId);

          if (draft.action === "FULL") {
            return null;
          }

          return {
            cycleSelectionKey: cycle.id,
            lineId: line.lineId,
            action: draft.action,
            valueType: draft.valueType,
            value: Number(draft.value || 0),
          };
        })
        .filter((value) => value !== null)
    )
  );
  const serializedInvoiceAdjustments = JSON.stringify(
    selectedVisibleCycles.flatMap((cycle) =>
      (invoiceAdjustmentDraftsByCycle[cycle.id] ?? []).map((draft) => ({
        ...draft,
        cycleSelectionKey: cycle.id,
        value: Number(draft.value || 0),
      }))
    )
  );
  const serializedCarryForwardSelections = JSON.stringify(
    selectedVisibleCycles.flatMap((cycle) =>
      getAssignedCarryForwards(cycle.id)
        .filter((source) =>
          isCarryForwardEnabled(cycle.id, source.carryForwardKey)
        )
        .map((source) => ({
          cycleSelectionKey: cycle.id,
          carryForwardKey: source.carryForwardKey,
        }))
    )
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
      [currentTenantId]: visibleCycles.map((cycle) => cycle.id),
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
    const cycle = visibleCycles.find((candidate) => candidate.id === cycleId);

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

  function updateLineAdjustment(
    cycleId: string,
    lineId: string,
    changes: Partial<LineAdjustmentDraft>
  ) {
    setLineAdjustmentDraftsByCycle((current) => ({
      ...current,
      [cycleId]: {
        ...(current[cycleId] ?? {}),
        [lineId]: {
          ...getLineAdjustmentDraft(cycleId, lineId),
          ...changes,
        },
      },
    }));
  }

  function addInvoiceAdjustment(cycleId: string) {
    setInvoiceAdjustmentDraftsByCycle((current) => ({
      ...current,
      [cycleId]: [
        ...(current[cycleId] ?? []),
        {
          id: crypto.randomUUID(),
          adjustmentType: "DEDUCTION",
          valueType: "FIXED",
          value: "",
          targetLineId: WHOLE_INVOICE_TARGET,
          label: "",
        },
      ],
    }));
  }

  function updateInvoiceAdjustment(
    cycleId: string,
    adjustmentId: string,
    changes: Partial<InvoiceAdjustmentDraft>
  ) {
    setInvoiceAdjustmentDraftsByCycle((current) => ({
      ...current,
      [cycleId]: (current[cycleId] ?? []).map((draft) =>
        draft.id === adjustmentId ? { ...draft, ...changes } : draft
      ),
    }));
  }

  function removeInvoiceAdjustment(cycleId: string, adjustmentId: string) {
    setInvoiceAdjustmentDraftsByCycle((current) => ({
      ...current,
      [cycleId]: (current[cycleId] ?? []).filter(
        (draft) => draft.id !== adjustmentId
      ),
    }));
  }

  function toggleCarryForward(cycleId: string, carryForwardKey: string) {
    setCarryForwardEnabledByCycle((current) => ({
      ...current,
      [cycleId]: {
        ...(current[cycleId] ?? {}),
        [carryForwardKey]: !isCarryForwardEnabled(cycleId, carryForwardKey),
      },
    }));
  }

  function renderLineAdjustmentCard(
    cycle: PendingCycleOption,
    line: InvoiceGenerationLinePreview,
    details?: ReactNode
  ) {
    const draft = getLineAdjustmentDraft(cycle.id, line.lineId);
    const outcome = getLineOutcome(cycle.id, line);

    return (
      <div
        key={line.lineId}
        className="rounded-[0.9rem] border border-border/55 bg-background/60 px-3 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{line.label}</p>
          <p className="text-sm font-semibold">{formatMoney(line.amount)}</p>
        </div>
        {details ? <div className="mt-1 text-xs text-muted-foreground">{details}</div> : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_10rem]">
          <div className="space-y-2">
            <Label htmlFor={`${cycle.id}-${line.lineId}-action`}>Billing action</Label>
            <select
              id={`${cycle.id}-${line.lineId}-action`}
              value={draft.action}
              onChange={(event) =>
                updateLineAdjustment(cycle.id, line.lineId, {
                  action: event.target.value as InvoiceGenerationAdjustmentAction,
                })
              }
              className={selectClassName}
            >
              <option value="FULL">
                {INVOICE_GENERATION_ADJUSTMENT_ACTION_LABELS.FULL}
              </option>
              <option value="DISCOUNT">
                {INVOICE_GENERATION_ADJUSTMENT_ACTION_LABELS.DISCOUNT}
              </option>
              <option value="DEFER">
                {INVOICE_GENERATION_ADJUSTMENT_ACTION_LABELS.DEFER}
              </option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${cycle.id}-${line.lineId}-value-type`}>Value mode</Label>
            <select
              id={`${cycle.id}-${line.lineId}-value-type`}
              value={draft.valueType}
              onChange={(event) =>
                updateLineAdjustment(cycle.id, line.lineId, {
                  valueType: event.target.value as InvoiceGenerationAdjustmentValueType,
                })
              }
              className={selectClassName}
              disabled={draft.action === "FULL"}
            >
              <option value="FIXED">
                {INVOICE_GENERATION_ADJUSTMENT_VALUE_TYPE_LABELS.FIXED}
              </option>
              <option value="PERCENT">
                {INVOICE_GENERATION_ADJUSTMENT_VALUE_TYPE_LABELS.PERCENT}
              </option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${cycle.id}-${line.lineId}-value`}>
              {draft.valueType === "PERCENT" ? "Percent" : "Amount"}
            </Label>
            <Input
              id={`${cycle.id}-${line.lineId}-value`}
              type="number"
              min="0"
              step={draft.valueType === "PERCENT" ? "0.01" : "0.01"}
              value={draft.value}
              onChange={(event) =>
                updateLineAdjustment(cycle.id, line.lineId, {
                  value: event.target.value,
                })
              }
              className="field-blank h-11"
              disabled={draft.action === "FULL"}
              placeholder={draft.valueType === "PERCENT" ? "10" : "0.00"}
            />
          </div>
        </div>

        <div className="mt-3 rounded-[0.8rem] border border-border/55 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Bill now: {formatMoney(outcome.billedAmount)}</span>
            {outcome.discountAmount > 0 ? (
              <span>Discount: {formatMoney(outcome.discountAmount)}</span>
            ) : null}
            {outcome.deferredAmount > 0 ? (
              <span>Bill later: {formatMoney(outcome.deferredAmount)}</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="lineAdjustments" value={serializedLineAdjustments} readOnly />
      <input
        type="hidden"
        name="invoiceAdjustments"
        value={serializedInvoiceAdjustments}
        readOnly
      />
      <input
        type="hidden"
        name="carryForwardSelections"
        value={serializedCarryForwardSelections}
        readOnly
      />

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
                  Billing periods are derived from each contract&apos;s billing anchor.
                  Pick the business first, then choose the invoice months to issue.
                  For each selected line, you can bill in full, discount part now, or
                  move part to a later invoice.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.45rem] border border-border/60 bg-background/55 p-4">
            <p className="text-sm font-medium">What this run includes</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Base rent is added automatically from the contract cycle.</li>
              <li>Recurring charges appear when effective in that cycle.</li>
              <li>Dedicated-meter utility readings stay selectable per cycle.</li>
              <li>COSA allocations inside the cycle auto-attach once saved.</li>
              <li>Deferred balances can be carried into the next selected invoice.</li>
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
              <FieldError message={state.errors?.lineAdjustments?.[0]} />
              <FieldError message={state.errors?.invoiceAdjustments?.[0]} />
              <FieldError message={state.errors?.carryForwardSelections?.[0]} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="space-y-4 rounded-[1.2rem] border border-border/60 bg-background/45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Invoices to generate</p>
                    <p className="text-sm text-muted-foreground">
                      Check billing months, keep or remove utility readings, then set
                      bill-in-full, discount, or bill-later for each line.
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
                    No eligible invoice cycles are available for the selected issue
                    date.
                  </p>
                ) : (
                  <div className="max-h-[42rem] space-y-2 overflow-y-auto pr-1">
                    {visibleCycles.map((cycle) => {
                      const isChecked = effectiveSelectedCycleKeys.includes(cycle.id);
                      const effectiveReadingSelection = getEffectiveReadingSelection(cycle);
                      const assignedCarryForwards = getAssignedCarryForwards(cycle.id);

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

                          {isChecked ? (
                            <div className="mt-3 space-y-3">
                              <div className="rounded-[0.95rem] border border-border/60 bg-background/45 p-3">
                                <div className="space-y-1">
                                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                    Rent
                                  </p>
                                  <p className="text-xs leading-5 text-muted-foreground">
                                    Base contract rent for this billing cycle.
                                  </p>
                                </div>
                                <div className="mt-2">
                                  {renderLineAdjustmentCard(cycle, cycle.rentLine, (
                                    <p>{cycle.label}</p>
                                  ))}
                                </div>
                              </div>

                              {cycle.recurringChargeOptions.length > 0 ? (
                                <div className="rounded-[0.95rem] border border-border/60 bg-background/45 p-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                      Recurring charges
                                    </p>
                                    <p className="text-xs leading-5 text-muted-foreground">
                                      These lines auto-attach when effective in this cycle.
                                    </p>
                                  </div>

                                  <div className="mt-2 space-y-2">
                                    {cycle.recurringChargeOptions.map((charge) =>
                                      renderLineAdjustmentCard(cycle, charge, (
                                        <p>{charge.chargeTypeLabel} · {charge.effectiveLabel}</p>
                                      ))
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              {cycle.cosaOptions.length > 0 ? (
                                <div className="rounded-[0.95rem] border border-border/60 bg-background/45 p-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                      COSA allocations
                                    </p>
                                    <p className="text-xs leading-5 text-muted-foreground">
                                      Saved uninvoiced COSA lines inside this cycle auto-attach.
                                    </p>
                                  </div>

                                  <div className="mt-2 space-y-2">
                                    {cycle.cosaOptions.map((allocation) =>
                                      renderLineAdjustmentCard(cycle, allocation, (
                                        <div className="grid gap-1 sm:grid-cols-2">
                                          <p>Billing date: {allocation.billingDateLabel}</p>
                                          <p>
                                            Basis: {allocation.basisLabel} ·{" "}
                                            {allocation.allocationTypeLabel}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              {cycle.readingOptions.length > 0 ? (
                                <div className="rounded-[0.95rem] border border-border/60 bg-background/45 p-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                      Utility readings
                                    </p>
                                    <p className="text-xs leading-5 text-muted-foreground">
                                      Connected dedicated-meter readings for this cycle. Uncheck
                                      any line you do not want to bill now.
                                    </p>
                                  </div>

                                  <div className="mt-2 space-y-2">
                                    {cycle.readingOptions.map((reading) => {
                                      const isReadingChecked = effectiveReadingSelection.includes(
                                        reading.selectionKey
                                      );

                                      return (
                                        <div
                                          key={reading.selectionKey}
                                          className={`rounded-[0.9rem] border px-3 py-3 transition-colors ${
                                            isReadingChecked
                                              ? "border-primary/45 bg-primary/6"
                                              : "border-border/55 bg-background/60"
                                          }`}
                                        >
                                          <div className="flex items-start gap-3">
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
                                            <div className="min-w-0 flex-1 space-y-3">
                                              <div className="space-y-1">
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

                                              {isReadingChecked
                                                ? renderLineAdjustmentCard(cycle, reading)
                                                : null}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}

                              <div className="rounded-[0.95rem] border border-border/60 bg-background/45 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                      Additions and deductions
                                    </p>
                                    <p className="text-xs leading-5 text-muted-foreground">
                                      Add audited positive or negative lines to this invoice.
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="button-blank rounded-full"
                                    onClick={() => addInvoiceAdjustment(cycle.id)}
                                  >
                                    <Plus />
                                    Add adjustment
                                  </Button>
                                </div>

                                <div className="mt-3 space-y-3">
                                  {(invoiceAdjustmentDraftsByCycle[cycle.id] ?? []).map(
                                    (draft) => {
                                      const targetLine = getBillableLines(cycle).find(
                                        (line) => line.lineId === draft.targetLineId
                                      );
                                      const basisAmount =
                                        targetLine?.amount ??
                                        getBillableLines(cycle).reduce(
                                          (sum, line) => sum + line.amount,
                                          0
                                        );
                                      const previewAmount = calculateInvoiceAdjustmentAmount({
                                        valueType: draft.valueType,
                                        value: Number(draft.value || 0),
                                        basisAmount,
                                      });

                                      return (
                                        <div
                                          key={draft.id}
                                          className="rounded-[0.9rem] border border-border/55 bg-background/60 p-3"
                                        >
                                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[9rem_11rem_minmax(0,1fr)_9rem_auto]">
                                            <div className="space-y-2">
                                              <Label>Type</Label>
                                              <select
                                                value={draft.adjustmentType}
                                                onChange={(event) =>
                                                  updateInvoiceAdjustment(cycle.id, draft.id, {
                                                    adjustmentType: event.target
                                                      .value as InvoiceAdjustmentType,
                                                  })
                                                }
                                                className={selectClassName}
                                              >
                                                <option value="ADDITION">Addition</option>
                                                <option value="DEDUCTION">Deduction</option>
                                              </select>
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Calculation</Label>
                                              <select
                                                value={draft.valueType}
                                                onChange={(event) =>
                                                  updateInvoiceAdjustment(cycle.id, draft.id, {
                                                    valueType: event.target
                                                      .value as InvoiceAdjustmentValueType,
                                                  })
                                                }
                                                className={selectClassName}
                                              >
                                                <option value="FIXED">Fixed amount</option>
                                                <option value="PERCENTAGE">Percentage</option>
                                              </select>
                                            </div>
                                            <div className="space-y-2">
                                              <Label>Target</Label>
                                              <select
                                                value={draft.targetLineId}
                                                onChange={(event) =>
                                                  updateInvoiceAdjustment(cycle.id, draft.id, {
                                                    targetLineId: event.target.value,
                                                  })
                                                }
                                                className={selectClassName}
                                              >
                                                <option value={WHOLE_INVOICE_TARGET}>
                                                  Whole invoice
                                                </option>
                                                {getBillableLines(cycle).map((line) => (
                                                  <option key={line.lineId} value={line.lineId}>
                                                    {line.label} · {formatMoney(line.amount)}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="space-y-2">
                                              <Label>
                                                {draft.valueType === "PERCENTAGE"
                                                  ? "Percent"
                                                  : "Amount"}
                                              </Label>
                                              <Input
                                                type="number"
                                                min="0.01"
                                                max={
                                                  draft.valueType === "PERCENTAGE"
                                                    ? "100"
                                                    : undefined
                                                }
                                                step="0.01"
                                                value={draft.value}
                                                onChange={(event) =>
                                                  updateInvoiceAdjustment(cycle.id, draft.id, {
                                                    value: event.target.value,
                                                  })
                                                }
                                                className="field-blank h-11"
                                              />
                                            </div>
                                            <div className="flex items-end">
                                              <Button
                                                type="button"
                                                variant="outline"
                                                className="button-blank h-11 rounded-xl"
                                                onClick={() =>
                                                  removeInvoiceAdjustment(cycle.id, draft.id)
                                                }
                                                aria-label="Remove adjustment"
                                              >
                                                <Trash2 />
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                            <div className="space-y-2">
                                              <Label>Reason</Label>
                                              <Input
                                                value={draft.label}
                                                onChange={(event) =>
                                                  updateInvoiceAdjustment(cycle.id, draft.id, {
                                                    label: event.target.value,
                                                  })
                                                }
                                                placeholder="Approved rent adjustment, correction, fee…"
                                                className="field-blank h-11"
                                              />
                                            </div>
                                            <div className="self-end rounded-xl border border-border/55 bg-muted/35 px-4 py-3 text-sm">
                                              {draft.adjustmentType === "DEDUCTION" ? "−" : "+"}
                                              {formatMoney(previewAmount)}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>

                              {assignedCarryForwards.length > 0 ? (
                                <div className="rounded-[0.95rem] border border-border/60 bg-background/45 p-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                      Deferred balances
                                    </p>
                                    <p className="text-xs leading-5 text-muted-foreground">
                                      These earlier billed-later amounts can attach as arrears on
                                      this invoice. They stay selected unless you remove them.
                                    </p>
                                  </div>

                                  <div className="mt-2 space-y-2">
                                    {assignedCarryForwards.map((source) => (
                                      <label
                                        key={source.carryForwardKey}
                                        className={`flex items-start gap-3 rounded-[0.9rem] border px-3 py-3 transition-colors ${
                                          isCarryForwardEnabled(
                                            cycle.id,
                                            source.carryForwardKey
                                          )
                                            ? "border-primary/45 bg-primary/6"
                                            : "border-border/55 bg-background/60"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isCarryForwardEnabled(
                                            cycle.id,
                                            source.carryForwardKey
                                          )}
                                          onChange={() =>
                                            toggleCarryForward(
                                              cycle.id,
                                              source.carryForwardKey
                                            )
                                          }
                                          className="mt-1 size-4 rounded border border-border bg-background text-primary accent-primary"
                                        />
                                        <div className="min-w-0 flex-1 space-y-1">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-medium">
                                              {source.sourceLabel}
                                            </p>
                                            <p className="text-sm font-semibold">
                                              {formatMoney(source.amount)}
                                            </p>
                                          </div>
                                          <p className="text-xs leading-5 text-muted-foreground">
                                            Will be added as arrears on this invoice if kept
                                            selected.
                                          </p>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
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

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              Issue run
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Generate invoices
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Each cycle includes base rent, active recurring charges, any
              uninvoiced COSA allocations, whichever connected-meter utility
              readings you keep selected, and any deferred balances you choose to
              carry forward.
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
                  {selectedVisibleCycles.slice(0, 8).map((cycle) => (
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
                      {utilityReadingSelectionCount} utility reading(s) currently
                      selected.
                    </p>
                  ) : null}
                  {selectedRecurringChargeCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedRecurringChargeCount} recurring charge line(s)
                      auto-included.
                    </p>
                  ) : null}
                  {selectedCosaCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedCosaCount} COSA allocation line(s) auto-included.
                    </p>
                  ) : null}
                  {selectedAdjustmentCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedAdjustmentCount} line adjustment(s) configured.
                    </p>
                  ) : null}
                  {selectedInvoiceAdjustmentCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedInvoiceAdjustmentCount} addition/deduction line(s)
                      configured.
                    </p>
                  ) : null}
                  {selectedCarryForwardCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedCarryForwardCount} deferred balance line(s) will carry
                      forward.
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
