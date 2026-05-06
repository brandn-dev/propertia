"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { HistoricalBacklogFormState } from "@/app/(dashboard)/billing/backlog/actions";
import {
  BACKLOG_ADJUSTMENT_TYPE_LABELS,
  BACKLOG_ADJUSTMENT_TYPES,
  BACKLOG_PAYMENT_STATUS_LABELS,
  BACKLOG_PAYMENT_STATUSES,
  UTILITY_TYPE_LABELS,
} from "@/lib/form-options";
import { addMonthsClamped, getBillingCycleIndex } from "@/lib/billing/cycles";
import { toDateInputValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/components/ui/toast-provider";

const selectClassName = "select-blank";

const initialState: HistoricalBacklogFormState = {};

type ContractOption = {
  id: string;
  tenantId: string;
  status: string;
  paymentStartDate: string;
  endDate: string;
  monthlyRent: string;
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
  advanceRent: string;
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
  meters: {
    id: string;
    propertyId: string;
    tenantId: string | null;
    meterCode: string;
    utilityType: keyof typeof UTILITY_TYPE_LABELS;
  }[];
  pendingBacklogCycles: {
    key: string;
    start: string;
    end: string;
    label: string;
  }[];
};

type HistoricalBacklogFormProps = {
  formAction: (
    state: HistoricalBacklogFormState,
    formData: FormData
  ) => Promise<HistoricalBacklogFormState>;
  contractOptions: ContractOption[];
  cutoffLabel: string;
  initialSelection?: {
    tenantId?: string;
    contractId?: string;
    cycleKey?: string;
  };
};

type UtilityReadingRow = {
  id: string;
  meterId: string;
  readingDate: string;
  previousReading: string;
  currentReading: string;
  ratePerUnit: string;
};

type UtilityChargeRow = {
  id: string;
  utilityType: keyof typeof UTILITY_TYPE_LABELS;
  label: string;
  amount: string;
};

type AdjustmentRow = {
  id: string;
  itemType: (typeof BACKLOG_ADJUSTMENT_TYPES)[number];
  label: string;
  amount: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function formatTenantName(contract: ContractOption["tenant"]) {
  return (
    contract.businessName ||
    [contract.firstName, contract.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

function buildLocalId() {
  return Math.random().toString(36).slice(2, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function getDefaultIssueDate(cycleEnd: string) {
  return toDateInputValue(new Date(cycleEnd));
}

function getDefaultDueDate(cycleEnd: string) {
  return addDays(toDateInputValue(new Date(cycleEnd)), 7);
}

function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function getUtilityServiceWindow(cycleStartValue: string) {
  const cycleStart = new Date(cycleStartValue);
  const serviceStart = addMonthsClamped(cycleStart, -1);
  const serviceEnd = new Date(cycleStart);
  serviceEnd.setDate(serviceEnd.getDate() - 1);
  serviceEnd.setHours(23, 59, 59, 999);

  return {
    label: formatMonthLabel(serviceStart),
    rangeLabel: `${toDateInputValue(serviceStart)} to ${toDateInputValue(serviceEnd)}`,
  };
}

function getAutoFreeRentConcessionAmount(params: {
  paymentStartDate: string;
  freeRentCycles: number;
  cycleStart?: string;
  rentAmount: string;
}) {
  const { paymentStartDate, freeRentCycles, cycleStart, rentAmount } = params;

  if (!cycleStart || freeRentCycles <= 0) {
    return 0;
  }

  const cycleIndex = getBillingCycleIndex(
    new Date(paymentStartDate),
    new Date(cycleStart)
  );

  if (cycleIndex < 0 || cycleIndex >= freeRentCycles) {
    return 0;
  }

  const parsedRentAmount = Number(rentAmount);
  return Number.isFinite(parsedRentAmount) && parsedRentAmount > 0
    ? parsedRentAmount
    : 0;
}

function deriveWholeMonths(amount: number, baseRent: number) {
  if (amount <= 0 || baseRent <= 0) {
    return 0;
  }

  const ratio = amount / baseRent;
  const rounded = Math.round(ratio);

  return Math.abs(ratio - rounded) < 0.01 ? rounded : 0;
}

function buildAdvanceApplicationCycleIndexes(params: {
  totalCycles: number;
  freeRentCycles: number;
  advanceRentMonths: number;
  application: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
}) {
  const { totalCycles, freeRentCycles, advanceRentMonths, application } = params;
  const billableCycleIndexes = Array.from({ length: totalCycles }, (_, index) => index)
    .filter((index) => index >= freeRentCycles);

  return new Set(
    application === "LAST_BILLABLE_CYCLES"
      ? billableCycleIndexes.slice(-advanceRentMonths)
      : billableCycleIndexes.slice(0, advanceRentMonths)
  );
}

function getCycleCount(paymentStartDate: string, endDate: string) {
  const anchorDate = new Date(paymentStartDate);
  const contractEndDate = new Date(endDate);
  let count = 0;

  while (count < 240) {
    const cycle = addMonthsClamped(anchorDate, count);

    if (new Date(cycle).getTime() > contractEndDate.getTime()) {
      break;
    }

    count += 1;
  }

  return count;
}

function getAutoAdvanceRentEffects(params: {
  paymentStartDate: string;
  endDate: string;
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
  advanceRent: string;
  cycleStart?: string;
  rentAmount: string;
}) {
  const {
    paymentStartDate,
    endDate,
    freeRentCycles,
    advanceRentMonths,
    advanceRentApplication,
    advanceRent,
    cycleStart,
    rentAmount,
  } = params;

  if (!cycleStart) {
    return { chargeAmount: 0, creditAmount: 0 };
  }

  const parsedRentAmount = Number(rentAmount);
  const baseRent = Number.isFinite(parsedRentAmount) ? parsedRentAmount : 0;
  const parsedAdvanceRent = Number(advanceRent);
  const resolvedAdvanceRentMonths =
    advanceRentMonths > 0
      ? advanceRentMonths
      : deriveWholeMonths(parsedAdvanceRent, baseRent);

  if (resolvedAdvanceRentMonths <= 0) {
    return { chargeAmount: 0, creditAmount: 0 };
  }

  const cycleIndex = getBillingCycleIndex(
    new Date(paymentStartDate),
    new Date(cycleStart)
  );

  if (cycleIndex < 0) {
    return { chargeAmount: 0, creditAmount: 0 };
  }

  const totalCycles = getCycleCount(paymentStartDate, endDate);
  const advanceApplicationCycleIndexes = buildAdvanceApplicationCycleIndexes({
    totalCycles,
    freeRentCycles,
    advanceRentMonths: resolvedAdvanceRentMonths,
    application: advanceRentApplication,
  });
  const isFreeRentCycle = cycleIndex < freeRentCycles;
  const isAdvanceRentApplicationCycle =
    !isFreeRentCycle && advanceApplicationCycleIndexes.has(cycleIndex);

  return {
    chargeAmount: cycleIndex === 0 ? parsedAdvanceRent : 0,
    creditAmount: isAdvanceRentApplicationCycle ? Math.min(baseRent, parsedRentAmount) : 0,
  };
}

function resolveInitialSelection(
  contractOptions: ContractOption[],
  initialSelection?: HistoricalBacklogFormProps["initialSelection"]
) {
  const selectedContract =
    contractOptions.find((contract) => contract.id === initialSelection?.contractId) ??
    contractOptions.find((contract) => contract.tenantId === initialSelection?.tenantId) ??
    contractOptions[0] ??
    null;
  const tenantId = selectedContract?.tenantId ?? "";
  const contractId = selectedContract?.id ?? "";
  const cycle =
    selectedContract?.pendingBacklogCycles.find(
      (entry) => entry.key === initialSelection?.cycleKey
    ) ??
    selectedContract?.pendingBacklogCycles[0] ??
    null;

  return {
    tenantId,
    contractId,
    cycleKey: cycle?.key ?? "",
    contract: selectedContract,
    cycle,
  };
}

export function HistoricalBacklogForm({
  formAction,
  contractOptions,
  cutoffLabel,
  initialSelection,
}: HistoricalBacklogFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  useActionToast({
    message: state.message,
    title: "Backlog month blocked",
    intent: "error",
  });
  const initialResolvedSelection = resolveInitialSelection(
    contractOptions,
    initialSelection
  );
  const [selectedTenantId, setSelectedTenantId] = useState(
    initialResolvedSelection.tenantId
  );
  const [selectedContractId, setSelectedContractId] = useState(
    initialResolvedSelection.contractId
  );
  const [selectedCycleKey, setSelectedCycleKey] = useState(
    initialResolvedSelection.cycleKey
  );
  const [rentAmount, setRentAmount] = useState(
    initialResolvedSelection.contract?.monthlyRent ?? ""
  );
  const [issueDate, setIssueDate] = useState(
    initialResolvedSelection.cycle
      ? getDefaultIssueDate(initialResolvedSelection.cycle.end)
      : ""
  );
  const [dueDate, setDueDate] = useState(
    initialResolvedSelection.cycle
      ? getDefaultDueDate(initialResolvedSelection.cycle.end)
      : ""
  );
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<
    (typeof BACKLOG_PAYMENT_STATUSES)[number]
  >("UNPAID");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [utilityReadings, setUtilityReadings] = useState<UtilityReadingRow[]>([]);
  const [utilityCharges, setUtilityCharges] = useState<UtilityChargeRow[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);

  const tenantOptions = Array.from(
    new Map(
      contractOptions.map((contract) => [
        contract.tenantId,
        {
          id: contract.tenantId,
          label: formatTenantName(contract.tenant),
        },
      ])
    ).values()
  ).sort((left, right) => left.label.localeCompare(right.label));
  const visibleContracts = contractOptions.filter(
    (contract) => contract.tenantId === selectedTenantId
  );
  const currentContract =
    visibleContracts.find((contract) => contract.id === selectedContractId) ??
    visibleContracts[0] ??
    null;
  const currentCycle =
    currentContract?.pendingBacklogCycles.find(
      (cycle) => cycle.key === selectedCycleKey
    ) ??
    currentContract?.pendingBacklogCycles[0] ??
    null;
  const utilityServiceWindow = currentCycle
    ? getUtilityServiceWindow(currentCycle.start)
    : null;
  const autoFreeRentConcessionAmount =
    currentContract && currentCycle
      ? getAutoFreeRentConcessionAmount({
          paymentStartDate: currentContract.paymentStartDate,
          freeRentCycles: currentContract.freeRentCycles,
          cycleStart: currentCycle.start,
          rentAmount,
        })
      : 0;
  const autoAdvanceRentEffects =
    currentContract && currentCycle
      ? getAutoAdvanceRentEffects({
          paymentStartDate: currentContract.paymentStartDate,
          endDate: currentContract.endDate,
          freeRentCycles: currentContract.freeRentCycles,
          advanceRentMonths: currentContract.advanceRentMonths,
          advanceRentApplication: currentContract.advanceRentApplication,
          advanceRent: currentContract.advanceRent,
          cycleStart: currentCycle.start,
          rentAmount,
        })
      : { chargeAmount: 0, creditAmount: 0 };
  const isCurrentCycleFreeRent = autoFreeRentConcessionAmount > 0;
  const hasAutoAdvanceRentCredit = autoAdvanceRentEffects.creditAmount > 0;

  function resetMonthState(nextContract: ContractOption | null, nextCycle: ContractOption["pendingBacklogCycles"][number] | null) {
    setRentAmount(nextContract?.monthlyRent ?? "");
    setIssueDate(nextCycle ? getDefaultIssueDate(nextCycle.end) : "");
    setDueDate(nextCycle ? getDefaultDueDate(nextCycle.end) : "");
    setNotes("");
    setPaymentStatus("UNPAID");
    setPaymentAmount("");
    setPaymentDate("");
    setReferenceNumber("");
    setPaymentNotes("");
    setUtilityReadings([]);
    setUtilityCharges([]);
    setAdjustments([]);
  }

  function handleTenantChange(nextTenantId: string) {
    setSelectedTenantId(nextTenantId);
    const nextContracts = contractOptions.filter(
      (contract) => contract.tenantId === nextTenantId
    );
    const nextContract = nextContracts[0] ?? null;
    const nextCycle = nextContract?.pendingBacklogCycles[0] ?? null;
    setSelectedContractId(nextContract?.id ?? "");
    setSelectedCycleKey(nextCycle?.key ?? "");
    resetMonthState(nextContract, nextCycle);
  }

  function handleContractChange(nextContractId: string) {
    setSelectedContractId(nextContractId);
    const nextContract =
      visibleContracts.find((contract) => contract.id === nextContractId) ?? null;
    const nextCycle = nextContract?.pendingBacklogCycles[0] ?? null;
    setSelectedCycleKey(nextCycle?.key ?? "");
    resetMonthState(nextContract, nextCycle);
  }

  function handleCycleChange(nextCycleKey: string) {
    setSelectedCycleKey(nextCycleKey);
    const nextCycle =
      currentContract?.pendingBacklogCycles.find((cycle) => cycle.key === nextCycleKey) ??
      null;
    resetMonthState(currentContract, nextCycle);
  }

  function addUtilityReadingRow() {
    setUtilityReadings((current) => [
      ...current,
      {
        id: buildLocalId(),
        meterId: currentContract?.meters[0]?.id ?? "",
        readingDate: currentCycle ? toDateInputValue(new Date(currentCycle.end)) : "",
        previousReading: "",
        currentReading: "",
        ratePerUnit: "",
      },
    ]);
  }

  function updateUtilityReadingRow(
    rowId: string,
    key: keyof UtilityReadingRow,
    value: string
  ) {
    setUtilityReadings((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  }

  function removeUtilityReadingRow(rowId: string) {
    setUtilityReadings((current) => current.filter((row) => row.id !== rowId));
  }

  function addUtilityChargeRow() {
    setUtilityCharges((current) => [
      ...current,
      {
        id: buildLocalId(),
        utilityType: "WATER",
        label: "",
        amount: "",
      },
    ]);
  }

  function updateUtilityChargeRow(
    rowId: string,
    key: keyof UtilityChargeRow,
    value: string
  ) {
    setUtilityCharges((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  }

  function removeUtilityChargeRow(rowId: string) {
    setUtilityCharges((current) => current.filter((row) => row.id !== rowId));
  }

  function addAdjustmentRow() {
    setAdjustments((current) => [
      ...current,
      {
        id: buildLocalId(),
        itemType: "ADJUSTMENT",
        label: "",
        amount: "",
      },
    ]);
  }

  function updateAdjustmentRow(
    rowId: string,
    key: keyof AdjustmentRow,
    value: string
  ) {
    setAdjustments((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  }

  function removeAdjustmentRow(rowId: string) {
    setAdjustments((current) => current.filter((row) => row.id !== rowId));
  }

  const canSubmit = Boolean(currentContract && currentCycle);
  const serializedUtilityReadings = JSON.stringify(
    utilityReadings.map((row) => ({
      meterId: row.meterId,
      readingDate: row.readingDate,
      previousReading: row.previousReading,
      currentReading: row.currentReading,
      ratePerUnit: row.ratePerUnit,
    }))
  );
  const serializedUtilityCharges = JSON.stringify(
    utilityCharges.map((row) => ({
      utilityType: row.utilityType,
      label: row.label,
      amount: row.amount,
    }))
  );
  const serializedAdjustments = JSON.stringify(
    adjustments.map((row) => ({
      itemType: row.itemType,
      label: row.label,
      amount: row.amount,
    }))
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="contractId" value={currentContract?.id ?? ""} readOnly />
      <input
        type="hidden"
        name="billingPeriodStart"
        value={currentCycle ? toDateInputValue(new Date(currentCycle.start)) : ""}
        readOnly
      />
      <input
        type="hidden"
        name="billingPeriodEnd"
        value={currentCycle ? toDateInputValue(new Date(currentCycle.end)) : ""}
        readOnly
      />
      <input
        type="hidden"
        name="utilityReadings"
        value={serializedUtilityReadings}
        readOnly
      />
      <input
        type="hidden"
        name="utilityCharges"
        value={serializedUtilityCharges}
        readOnly
      />
      <input
        type="hidden"
        name="adjustments"
        value={serializedAdjustments}
        readOnly
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="border-blank space-y-6 rounded-xl p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenantId">Tenant</Label>
                <select
                  id="tenantId"
                  value={selectedTenantId}
                  onChange={(event) => handleTenantChange(event.target.value)}
                  className={selectClassName}
                  disabled={tenantOptions.length === 0}
                >
                  {tenantOptions.length === 0 ? (
                    <option value="">No backlog-ready tenants</option>
                  ) : (
                    tenantOptions.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractIdSelect">Contract</Label>
                <select
                  id="contractIdSelect"
                  value={currentContract?.id ?? ""}
                  onChange={(event) => handleContractChange(event.target.value)}
                  className={selectClassName}
                  disabled={visibleContracts.length === 0}
                >
                  {visibleContracts.length === 0 ? (
                    <option value="">No backlog-ready contracts</option>
                  ) : (
                    visibleContracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.property.propertyCode} · {contract.property.name}
                      </option>
                    ))
                  )}
                </select>
                <FieldError message={state.errors?.contractId?.[0]} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cycleKey">Historical month</Label>
                <select
                  id="cycleKey"
                  value={currentCycle?.key ?? ""}
                  onChange={(event) => handleCycleChange(event.target.value)}
                  className={selectClassName}
                  disabled={!currentContract}
                >
                  {currentContract?.pendingBacklogCycles.length ? (
                    currentContract.pendingBacklogCycles.map((cycle) => (
                      <option key={cycle.key} value={cycle.key}>
                        {cycle.label} · {toDateInputValue(new Date(cycle.start))} to{" "}
                        {toDateInputValue(new Date(cycle.end))}
                      </option>
                    ))
                  ) : (
                    <option value="">No missing historical months</option>
                  )}
                </select>
                <FieldError message={state.errors?.billingPeriodStart?.[0]} />
                <p className="text-sm text-muted-foreground">
                  Historical backlog includes transition month starting {cutoffLabel}.
                  Later months move to strict generator.
                </p>
              </div>

              {currentCycle ? (
                <>
                  <div className="space-y-2">
                    <Label>Rent month</Label>
                    <div className="field-blank flex min-h-11 items-center rounded-xl border px-4 text-sm text-muted-foreground">
                      {currentCycle.label} · {toDateInputValue(new Date(currentCycle.start))} to{" "}
                      {toDateInputValue(new Date(currentCycle.end))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Utility service month</Label>
                    <div className="field-blank flex min-h-11 items-center rounded-xl border px-4 text-sm text-muted-foreground">
                      {utilityServiceWindow?.label} · {utilityServiceWindow?.rangeLabel}
                    </div>
                  </div>
                </>
              ) : null}

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
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="field-blank h-11"
                />
                <FieldError message={state.errors?.dueDate?.[0]} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="rentAmount">Rent amount override</Label>
                <Input
                  id="rentAmount"
                  name="rentAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={rentAmount}
                  onChange={(event) => setRentAmount(event.target.value)}
                  className="field-blank h-11"
                  placeholder="Leave blank if this month has no rent line."
                />
                <FieldError message={state.errors?.rentAmount?.[0]} />
                {isCurrentCycleFreeRent ? (
                  <p className="text-sm text-muted-foreground">
                    Free-rent cycle detected. Matching concession of{" "}
                    {autoFreeRentConcessionAmount.toFixed(2)} applies
                    automatically on save.
                  </p>
                ) : null}
                {hasAutoAdvanceRentCredit ? (
                  <p className="text-sm text-muted-foreground">
                    Advance-rent credit of{" "}
                    {autoAdvanceRentEffects.creditAmount.toFixed(2)} applies
                    automatically on save.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border-blank rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.04em]">
                  Utility readings
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use real meter chronology when you have it. These rows create real
                  meter readings and link them to the backlog invoice.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="button-blank rounded-full"
                onClick={addUtilityReadingRow}
                disabled={!currentContract || currentContract.meters.length === 0}
              >
                <Plus />
                Add reading
              </Button>
            </div>
            <FieldError message={state.errors?.utilityReadings?.[0]} />

            {currentContract && currentContract.meters.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No dedicated tenant meters are assigned to this contract. Use manual
                utility charges instead.
              </p>
            ) : null}

            <div className="mt-6 space-y-4">
              {utilityReadings.map((row) => (
                <div
                  key={row.id}
                  className="rounded-[1.35rem] border border-border/60 bg-background/55 p-4"
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <div className="space-y-2 xl:col-span-2">
                      <Label>Meter</Label>
                      <select
                        value={row.meterId}
                        onChange={(event) =>
                          updateUtilityReadingRow(row.id, "meterId", event.target.value)
                        }
                        className={selectClassName}
                      >
                        <option value="">Select a meter</option>
                        {currentContract?.meters.map((meter) => (
                          <option key={meter.id} value={meter.id}>
                            {meter.meterCode} · {UTILITY_TYPE_LABELS[meter.utilityType]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Reading date</Label>
                      <Input
                        type="date"
                        value={row.readingDate}
                        onChange={(event) =>
                          updateUtilityReadingRow(
                            row.id,
                            "readingDate",
                            event.target.value
                          )
                        }
                        className="field-blank h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Previous</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.previousReading}
                        onChange={(event) =>
                          updateUtilityReadingRow(
                            row.id,
                            "previousReading",
                            event.target.value
                          )
                        }
                        className="field-blank h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Current</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.currentReading}
                        onChange={(event) =>
                          updateUtilityReadingRow(
                            row.id,
                            "currentReading",
                            event.target.value
                          )
                        }
                        className="field-blank h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Rate</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.ratePerUnit}
                          onChange={(event) =>
                            updateUtilityReadingRow(
                              row.id,
                              "ratePerUnit",
                              event.target.value
                            )
                          }
                          className="field-blank h-11"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="button-blank h-11 rounded-xl"
                          onClick={() => removeUtilityReadingRow(row.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-blank rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.04em]">
                  Manual utility charges
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use this when old utility amounts are known but a safe meter-reading
                  insertion is not possible.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="button-blank rounded-full"
                onClick={addUtilityChargeRow}
              >
                <Plus />
                Add utility charge
              </Button>
            </div>
            <FieldError message={state.errors?.utilityCharges?.[0]} />

            <div className="mt-6 space-y-4">
              {utilityCharges.map((row) => (
                <div
                  key={row.id}
                  className="rounded-[1.35rem] border border-border/60 bg-background/55 p-4"
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Utility</Label>
                      <select
                        value={row.utilityType}
                        onChange={(event) =>
                          updateUtilityChargeRow(
                            row.id,
                            "utilityType",
                            event.target.value
                          )
                        }
                        className={selectClassName}
                      >
                        {Object.entries(UTILITY_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 xl:col-span-2">
                      <Label>Label</Label>
                      <Input
                        value={row.label}
                        onChange={(event) =>
                          updateUtilityChargeRow(row.id, "label", event.target.value)
                        }
                        className="field-blank h-11"
                        placeholder="Optional note or bill reference"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.amount}
                          onChange={(event) =>
                            updateUtilityChargeRow(row.id, "amount", event.target.value)
                          }
                          className="field-blank h-11"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="button-blank h-11 rounded-xl"
                          onClick={() => removeUtilityChargeRow(row.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-blank rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.04em]">
                  Other charges and credits
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Add arrears, manual adjustments, or negative credits that change the
                  final invoice total.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="button-blank rounded-full"
                onClick={addAdjustmentRow}
              >
                <Plus />
                Add line
              </Button>
            </div>
            <FieldError message={state.errors?.adjustments?.[0]} />

            <div className="mt-6 space-y-4">
              {adjustments.map((row) => (
                <div
                  key={row.id}
                  className="rounded-[1.35rem] border border-border/60 bg-background/55 p-4"
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <select
                        value={row.itemType}
                        onChange={(event) =>
                          updateAdjustmentRow(row.id, "itemType", event.target.value)
                        }
                        className={selectClassName}
                      >
                        {BACKLOG_ADJUSTMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {BACKLOG_ADJUSTMENT_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 xl:col-span-2">
                      <Label>Label</Label>
                      <Input
                        value={row.label}
                        onChange={(event) =>
                          updateAdjustmentRow(row.id, "label", event.target.value)
                        }
                        className="field-blank h-11"
                        placeholder="Security, credit memo, prior balance, etc."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={row.amount}
                          onChange={(event) =>
                            updateAdjustmentRow(row.id, "amount", event.target.value)
                          }
                          className="field-blank h-11"
                          placeholder="-500.00 or 500.00"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="button-blank h-11 rounded-xl"
                          onClick={() => removeAdjustmentRow(row.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-blank rounded-xl p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="paymentStatus">Payment snapshot</Label>
                <select
                  id="paymentStatus"
                  name="paymentStatus"
                  value={paymentStatus}
                  onChange={(event) =>
                    setPaymentStatus(
                      event.target.value as (typeof BACKLOG_PAYMENT_STATUSES)[number]
                    )
                  }
                  className={selectClassName}
                >
                  {BACKLOG_PAYMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {BACKLOG_PAYMENT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>

              {paymentStatus === "PARTIAL" ? (
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Partial payment amount</Label>
                  <Input
                    id="paymentAmount"
                    name="paymentAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    className="field-blank h-11"
                  />
                  <FieldError message={state.errors?.paymentAmount?.[0]} />
                </div>
              ) : (
                <input type="hidden" name="paymentAmount" value={paymentAmount} readOnly />
              )}

              {paymentStatus !== "UNPAID" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">Payment date</Label>
                    <Input
                      id="paymentDate"
                      name="paymentDate"
                      type="date"
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                      className="field-blank h-11"
                    />
                    <FieldError message={state.errors?.paymentDate?.[0]} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referenceNumber">Reference number</Label>
                    <Input
                      id="referenceNumber"
                      name="referenceNumber"
                      value={referenceNumber}
                      onChange={(event) => setReferenceNumber(event.target.value)}
                      className="field-blank h-11"
                      placeholder="Optional OR / receipt reference"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="paymentNotes">Payment notes</Label>
                    <Textarea
                      id="paymentNotes"
                      name="paymentNotes"
                      value={paymentNotes}
                      onChange={(event) => setPaymentNotes(event.target.value)}
                      className="field-blank min-h-24"
                      placeholder="Optional remarks for the historical payment record."
                    />
                  </div>
                </>
              ) : (
                <>
                  <input type="hidden" name="paymentDate" value={paymentDate} readOnly />
                  <input
                    type="hidden"
                    name="referenceNumber"
                    value={referenceNumber}
                    readOnly
                  />
                  <input type="hidden" name="paymentNotes" value={paymentNotes} readOnly />
                </>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Month notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="field-blank min-h-24"
                  placeholder="Optional context for this historical month."
                />
              </div>
            </div>

            {state.message ? (
              <div className="mt-5 rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
                {state.message}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              Historical entry
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Backlog month
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This creates a real backlog invoice, optional payment, and real meter
              readings when safe. Strict automated billing owns later months after
              the transition month starting {` ${cutoffLabel}`}.
            </p>

            <div className="mt-5 space-y-3 rounded-[1.2rem] border border-border/60 bg-background/60 px-4 py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Tenant</span>
                <span className="font-medium">
                  {currentContract ? formatTenantName(currentContract.tenant) : "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Property</span>
                <span className="font-medium">
                  {currentContract
                    ? `${currentContract.property.propertyCode} · ${currentContract.property.name}`
                    : "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Month</span>
                <span className="font-medium">{currentCycle?.label ?? "Not set"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Readings</span>
                <span className="font-medium">{utilityReadings.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Manual utility lines</span>
                <span className="font-medium">{utilityCharges.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Other adjustments</span>
                <span className="font-medium">{adjustments.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Auto free-rent credit</span>
                <span className="font-medium">
                  {isCurrentCycleFreeRent
                    ? autoFreeRentConcessionAmount.toFixed(2)
                    : "None"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Auto advance-rent credit</span>
                <span className="font-medium">
                  {hasAutoAdvanceRentCredit
                    ? autoAdvanceRentEffects.creditAmount.toFixed(2)
                    : "None"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Payment snapshot</span>
                <span className="font-medium">
                  {BACKLOG_PAYMENT_STATUS_LABELS[paymentStatus]}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || !canSubmit}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                Save backlog month
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
              <Button
                render={<Link href="/billing/generate" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <CircleDollarSign />
                Strict generator
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
