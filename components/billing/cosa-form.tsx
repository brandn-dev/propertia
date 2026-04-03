"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, LoaderCircle, Save } from "lucide-react";
import type { CosaFormState } from "@/app/(dashboard)/billing/actions";
import { calculateCosaAllocations } from "@/lib/billing/cosa";
import { ALLOCATION_TYPES, ALLOCATION_TYPE_LABELS } from "@/lib/form-options";
import { formatCurrency, formatDate } from "@/lib/format";
import { getDescendantPropertyIds } from "@/lib/property-tree";
import { formatUtilityQuantity, getUtilityRateLabel } from "@/lib/utility-units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CosaFormState = {};

const selectClassName =
  "select-blank";

type AllocationEntry = {
  contractId: string;
  percentage: string;
  unitCount: string;
  amount: string;
};

type CosaFormProps = {
  mode: "create" | "edit";
  formAction: (
    state: CosaFormState,
    formData: FormData,
  ) => Promise<CosaFormState>;
  propertyOptions: {
    id: string;
    name: string;
    propertyCode: string;
    parentPropertyId: string | null;
    status: string;
  }[];
  meterOptions: {
    id: string;
    meterCode: string;
    utilityType: string;
    propertyId: string;
    property: {
      name: string;
      propertyCode: string;
    };
    readings: {
      id: string;
      readingDate: string;
      previousReading: string;
      currentReading: string;
      consumption: string;
      ratePerUnit: string;
      totalAmount: string;
      cosaId: string | null;
    }[];
  }[];
  contractOptions: {
    id: string;
    status: string;
    paymentStartDate: string;
    paymentAnchorLabel: string;
    property: {
      id: string;
      parentPropertyId: string | null;
      name: string;
      propertyCode: string;
      size: string | null;
    };
    tenant: {
      firstName: string | null;
      lastName: string | null;
      businessName: string | null;
    };
  }[];
  initialValues?: {
    propertyId: string;
    meterId: string;
    meterReadingId: string;
    description: string;
    totalAmount: string;
    billingDate: string;
    allocationType: (typeof ALLOCATION_TYPES)[number];
    allocations: AllocationEntry[];
  };
  lockedReason?: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function formatTenantName(
  tenant: CosaFormProps["contractOptions"][number]["tenant"],
) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

function buildEqualPercentages(count: number) {
  if (count <= 0) {
    return [];
  }

  const baseValue = Math.floor(10000 / count);
  const percentages = Array.from({ length: count }, () => baseValue);
  percentages[percentages.length - 1] += 10000 - baseValue * count;

  return percentages.map((value) => (value / 100).toFixed(2));
}

function buildEqualAmounts(totalAmount: string, count: number) {
  if (count <= 0) {
    return [];
  }

  const totalInCents = Math.round(Number(totalAmount || 0) * 100);

  if (!Number.isFinite(totalInCents) || totalInCents <= 0) {
    return Array.from({ length: count }, () => "");
  }

  const baseValue = Math.floor(totalInCents / count);
  const amounts = Array.from({ length: count }, () => baseValue);
  amounts[amounts.length - 1] += totalInCents - baseValue * count;

  return amounts.map((value) => (value / 100).toFixed(2));
}

function formatUnitLabel(value: string) {
  const quantity = Number(value || 0);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "0 units";
  }

  return `${quantity} ${quantity === 1 ? "unit" : "units"}`;
}

export function CosaForm({
  mode,
  formAction,
  propertyOptions,
  meterOptions,
  contractOptions,
  initialValues = {
    propertyId: "",
    meterId: "",
    meterReadingId: "",
    description: "",
    totalAmount: "",
    billingDate: "",
    allocationType: "EQUAL_SPLIT",
    allocations: [],
  },
  lockedReason,
}: CosaFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [propertyId, setPropertyId] = useState(initialValues.propertyId);
  const [meterId, setMeterId] = useState(initialValues.meterId);
  const [meterReadingId, setMeterReadingId] = useState(initialValues.meterReadingId);
  const [totalAmount, setTotalAmount] = useState(initialValues.totalAmount);
  const [allocationType, setAllocationType] = useState(
    initialValues.allocationType,
  );
  const [allocationEntries, setAllocationEntries] = useState<AllocationEntry[]>(
    initialValues.allocations,
  );

  const propertyScopeIds = useMemo(
    () =>
      propertyId
        ? getDescendantPropertyIds(propertyId, propertyOptions)
        : new Set<string>(),
    [propertyId, propertyOptions],
  );

  const visibleContracts = useMemo(
    () =>
      contractOptions.filter((contract) =>
        propertyScopeIds.has(contract.property.id),
      ),
    [contractOptions, propertyScopeIds],
  );

  const visibleMeters = useMemo(
    () => meterOptions.filter((meter) => meter.propertyId === propertyId),
    [meterOptions, propertyId],
  );

  const selectedMeter = useMemo(
    () => visibleMeters.find((meter) => meter.id === meterId) ?? null,
    [meterId, visibleMeters],
  );

  const availableReadings = useMemo(() => {
    if (!selectedMeter) {
      return [];
    }

    return selectedMeter.readings.filter(
      (reading) => !reading.cosaId || reading.id === meterReadingId,
    );
  }, [meterReadingId, selectedMeter]);

  const selectedMeterReading = useMemo(
    () =>
      availableReadings.find((reading) => reading.id === meterReadingId) ?? null,
    [availableReadings, meterReadingId],
  );

  const effectiveTotalAmount = selectedMeterReading
    ? selectedMeterReading.totalAmount
    : totalAmount;

  const contractLookup = useMemo(
    () => new Map(contractOptions.map((contract) => [contract.id, contract])),
    [contractOptions],
  );

  const previewResult = useMemo(() => {
    if (
      !effectiveTotalAmount ||
      Number(effectiveTotalAmount) <= 0 ||
      allocationEntries.length === 0
    ) {
      return {
        allocations: [] as ReturnType<typeof calculateCosaAllocations>,
        error: null as string | null,
      };
    }

    if (
      allocationType === "BY_AREA" &&
      allocationEntries.some((entry) => {
        const contract = contractLookup.get(entry.contractId);
        return !contract?.property.size || Number(contract.property.size) <= 0;
      })
    ) {
      return {
        allocations: [],
        error:
          "Every selected contract needs a property size for area-based allocation.",
      };
    }

    try {
        return {
          allocations: calculateCosaAllocations({
            allocationType,
            totalAmount: Number(effectiveTotalAmount),
            entries: allocationEntries.map((entry) => {
            const contract = contractLookup.get(entry.contractId);

              return {
                contractId: entry.contractId,
                percentage:
                  entry.percentage.trim() !== ""
                    ? Number(entry.percentage)
                    : null,
                unitCount:
                  entry.unitCount.trim() !== "" ? Number(entry.unitCount) : null,
                amount: entry.amount.trim() !== "" ? Number(entry.amount) : null,
                basisValue: contract?.property.size
                  ? Number(contract.property.size)
                  : null,
            };
          }),
        }),
        error: null,
      };
    } catch (error) {
      return {
        allocations: [],
        error:
          error instanceof Error
            ? error.message
            : "Allocations could not be calculated.",
      };
    }
  }, [allocationEntries, allocationType, contractLookup, effectiveTotalAmount]);

  function rehydrateEntriesForType(
    nextType: (typeof ALLOCATION_TYPES)[number],
    currentEntries: AllocationEntry[],
  ) {
    if (nextType === "PERCENTAGE") {
      const equalPercentages = buildEqualPercentages(currentEntries.length);

      return currentEntries.map((entry, index) => ({
        ...entry,
        percentage: equalPercentages[index] ?? entry.percentage,
        unitCount: "",
        amount: "",
      }));
    }

    if (nextType === "CUSTOM") {
      const equalAmounts = buildEqualAmounts(
        totalAmount,
        currentEntries.length,
      );

      return currentEntries.map((entry, index) => ({
        ...entry,
        percentage: "",
        unitCount: "",
        amount: equalAmounts[index] ?? entry.amount,
      }));
    }

    if (nextType === "PER_UNIT") {
      return currentEntries.map((entry) => ({
        ...entry,
        percentage: "",
        unitCount:
          entry.unitCount && Number(entry.unitCount) > 0 ? entry.unitCount : "1",
        amount: "",
      }));
    }

    return currentEntries.map((entry) => ({
      ...entry,
      percentage: "",
      unitCount: "",
      amount: "",
    }));
  }

  function handlePropertyChange(nextPropertyId: string) {
    setPropertyId(nextPropertyId);
    setMeterId((currentMeterId) => {
      if (!currentMeterId) {
        return currentMeterId;
      }

      const selectedMeter = meterOptions.find(
        (meter) => meter.id === currentMeterId,
      );

      return selectedMeter && selectedMeter.propertyId === nextPropertyId
        ? currentMeterId
        : "";
    });
    setMeterReadingId("");

    const nextScopeIds = getDescendantPropertyIds(
      nextPropertyId,
      propertyOptions,
    );

    setAllocationEntries((currentEntries) =>
      currentEntries.filter((entry) => {
        const contract = contractLookup.get(entry.contractId);
        return contract ? nextScopeIds.has(contract.property.id) : false;
      }),
    );
  }

  function handleMeterChange(nextMeterId: string) {
    setMeterId(nextMeterId);
    setMeterReadingId("");
  }

  function handleAllocationTypeChange(
    nextAllocationType: (typeof ALLOCATION_TYPES)[number],
  ) {
    setAllocationType(nextAllocationType);
    setAllocationEntries((currentEntries) =>
      rehydrateEntriesForType(nextAllocationType, currentEntries),
    );
  }

  function toggleContract(contractId: string, checked: boolean) {
    setAllocationEntries((currentEntries) => {
      if (checked) {
        if (currentEntries.some((entry) => entry.contractId === contractId)) {
          return currentEntries;
        }

        return rehydrateEntriesForType(allocationType, [
          ...currentEntries,
          {
            contractId,
            percentage: "",
            unitCount: "1",
            amount: "",
          },
        ]);
      }

      return rehydrateEntriesForType(
        allocationType,
        currentEntries.filter((entry) => entry.contractId !== contractId),
      );
    });
  }

  function updateAllocationEntry(
    contractId: string,
    key: "percentage" | "unitCount" | "amount",
    value: string,
  ) {
    setAllocationEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.contractId === contractId
          ? {
              ...entry,
              [key]: value,
            }
          : entry,
      ),
    );
  }

  const serializedAllocations = JSON.stringify(
    allocationEntries.map((entry) => ({
      contractId: entry.contractId,
      percentage: entry.percentage,
      unitCount: entry.unitCount,
      amount: entry.amount,
    })),
  );

  const previewLookup = new Map(
    previewResult.allocations.map((allocation) => [
      allocation.contractId,
      allocation,
    ]),
  );

  const selectedContracts = allocationEntries.flatMap((entry) => {
    const contract = contractLookup.get(entry.contractId);

    if (!contract) {
      return [];
    }

    return [
      {
        entry,
        contract,
        preview: previewLookup.get(entry.contractId),
      },
    ];
  });

  const previewTotal = previewResult.allocations.reduce(
    (sum, allocation) => sum + allocation.computedAmount,
    0,
  );
  const hasSelections = allocationEntries.length > 0;
  const isLocked = Boolean(lockedReason);

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="allocations"
        value={serializedAllocations}
        readOnly
      />
      <input type="hidden" name="meterReadingId" value={meterReadingId} readOnly />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="border-blank space-y-6 rounded-xl p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="propertyId">Property</Label>
                <select
                  id="propertyId"
                  name="propertyId"
                  value={propertyId}
                  onChange={(event) => handlePropertyChange(event.target.value)}
                  className={selectClassName}
                  disabled={pending || isLocked}
                >
                  <option value="">Select a property</option>
                  {propertyOptions.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.propertyCode} · {property.name}
                    </option>
                  ))}
                </select>
                <FieldError message={state.errors?.propertyId?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meterId">Linked shared meter</Label>
                <select
                  id="meterId"
                  name="meterId"
                  value={meterId}
                  onChange={(event) => handleMeterChange(event.target.value)}
                  className={selectClassName}
                  disabled={pending || isLocked || !propertyId}
                >
                  <option value="">No linked meter</option>
                  {visibleMeters.map((meter) => (
                    <option key={meter.id} value={meter.id}>
                      {meter.meterCode} ·{" "}
                      {meter.utilityType.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <FieldError message={state.errors?.meterId?.[0]} />
              </div>

              {meterId ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="meterReadingId">Applied shared-meter reading</Label>
                  <select
                    id="meterReadingId"
                    value={meterReadingId}
                    onChange={(event) => setMeterReadingId(event.target.value)}
                    className={selectClassName}
                    disabled={pending || isLocked || availableReadings.length === 0}
                  >
                    <option value="">No reading selected (manual amount)</option>
                    {availableReadings.map((reading) => (
                      <option key={reading.id} value={reading.id}>
                        {formatDate(reading.readingDate)} ·{" "}
                        {selectedMeter
                          ? formatUtilityQuantity(
                              selectedMeter.utilityType as Parameters<
                                typeof formatUtilityQuantity
                              >[0],
                              reading.consumption,
                            )
                          : reading.consumption}{" "}
                        · {formatCurrency(Number(reading.totalAmount))}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted-foreground">
                    {availableReadings.length > 0
                      ? "Choose a recorded reading to apply that shared-meter charge automatically."
                      : "No recorded readings are available for this shared meter yet. You can still enter a manual amount below."}
                  </p>
                  <FieldError message={state.errors?.meterReadingId?.[0]} />
                </div>
              ) : null}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  defaultValue={initialValues.description}
                  placeholder="Common area electricity for March 2026"
                  className="field-blank h-11"
                  disabled={pending || isLocked}
                />
                <FieldError message={state.errors?.description?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalAmount">Total amount</Label>
                <Input
                  id="totalAmount"
                  name="totalAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={effectiveTotalAmount}
                  onChange={(event) => setTotalAmount(event.target.value)}
                  placeholder="12000.00"
                  className="field-blank h-11"
                  disabled={pending || isLocked}
                  readOnly={Boolean(selectedMeterReading)}
                />
                <p className="text-sm text-muted-foreground">
                  {selectedMeterReading
                    ? "This amount is taken from the selected shared-meter reading."
                    : "Enter the monthly shared-charge total manually, or choose a recorded reading above."}
                </p>
                <FieldError message={state.errors?.totalAmount?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingDate">Billing date</Label>
                <Input
                  id="billingDate"
                  name="billingDate"
                  type="date"
                  defaultValue={initialValues.billingDate}
                  className="field-blank h-11"
                  disabled={pending || isLocked}
                />
                <FieldError message={state.errors?.billingDate?.[0]} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="allocationType">Allocation type</Label>
                <select
                  id="allocationType"
                  name="allocationType"
                  value={allocationType}
                  onChange={(event) =>
                    handleAllocationTypeChange(
                      event.target.value as (typeof ALLOCATION_TYPES)[number],
                    )
                  }
                  className={selectClassName}
                  disabled={pending || isLocked}
                >
                  {ALLOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ALLOCATION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  Choose how the total common-area charge should be shared
                  across the selected tenant contracts.
                </p>
              </div>
            </div>

            {lockedReason ? (
              <div className="rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
                {lockedReason}
              </div>
            ) : null}

            {state.message ? (
              <div className="rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
                {state.message}
              </div>
            ) : null}

            {selectedMeter && selectedMeterReading ? (
              <div className="rounded-[1.2rem] border border-border/60 bg-muted/45 px-4 py-4">
                <p className="text-sm font-medium text-foreground">
                  Applied reading summary
                </p>
                <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                  <p>
                    Reading date
                    <span className="mt-1 block text-foreground">
                      {formatDate(selectedMeterReading.readingDate)}
                    </span>
                  </p>
                  <p>
                    Previous to current
                    <span className="mt-1 block text-foreground">
                      {formatUtilityQuantity(
                        selectedMeter.utilityType as Parameters<
                          typeof formatUtilityQuantity
                        >[0],
                        selectedMeterReading.previousReading,
                      )}{" "}
                      to{" "}
                      {formatUtilityQuantity(
                        selectedMeter.utilityType as Parameters<
                          typeof formatUtilityQuantity
                        >[0],
                        selectedMeterReading.currentReading,
                      )}
                    </span>
                  </p>
                  <p>
                    Consumption
                    <span className="mt-1 block text-foreground">
                      {formatUtilityQuantity(
                        selectedMeter.utilityType as Parameters<
                          typeof formatUtilityQuantity
                        >[0],
                        selectedMeterReading.consumption,
                      )}
                    </span>
                  </p>
                  <p>
                    {getUtilityRateLabel(
                      selectedMeter.utilityType as Parameters<
                        typeof getUtilityRateLabel
                      >[0],
                    )}
                    <span className="mt-1 block text-foreground">
                      {formatCurrency(Number(selectedMeterReading.ratePerUnit))}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-blank rounded-xl p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.04em]">
                  Tenant allocation
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Pick the contracts that should share this COSA record. The
                  preview below uses the same split logic that invoice
                  generation will consume later.
                </p>
              </div>
              <div className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground">
                {allocationEntries.length} selected
              </div>
            </div>

            <FieldError message={state.errors?.allocations?.[0]} />

            {!propertyId ? (
              <div className="mt-6 rounded-[1.2rem] border border-dashed border-border/80 bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
                Select a property first to load eligible tenant contracts.
              </div>
            ) : visibleContracts.length === 0 ? (
              <div className="mt-6 rounded-[1.2rem] border border-dashed border-border/80 bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
                No active contracts were found in this property scope yet.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="space-y-3">
                  {visibleContracts.map((contract) => {
                    const isChecked = allocationEntries.some(
                      (entry) => entry.contractId === contract.id,
                    );
                    const selectedEntry = allocationEntries.find(
                      (entry) => entry.contractId === contract.id,
                    );
                    const preview = previewLookup.get(contract.id);

                    return (
                      <label
                        key={contract.id}
                        className="border-blank flex flex-col gap-4 rounded-xl p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) =>
                                toggleContract(
                                  contract.id,
                                  event.target.checked,
                                )
                              }
                              disabled={pending || isLocked}
                              className="mt-1 size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                {formatTenantName(contract.tenant)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {contract.property.propertyCode} ·{" "}
                                {contract.property.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Bills from {contract.paymentAnchorLabel}
                                {contract.property.size
                                  ? ` · ${contract.property.size} sqm`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          {isChecked ? (
                        <div className="text-right text-sm text-muted-foreground">
                          <p>
                            Preview:{" "}
                            <span className="font-medium text-foreground">
                              {preview
                                ? formatCurrency(preview.computedAmount)
                                : allocationType === "PER_UNIT"
                                  ? formatUnitLabel(selectedEntry?.unitCount ?? "")
                                  : "Pending"}
                            </span>
                          </p>
                          {preview ? (
                            <p>{preview.percentage.toFixed(2)}%</p>
                          ) : allocationType === "PER_UNIT" && selectedEntry ? (
                            <p>{formatUnitLabel(selectedEntry.unitCount)}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {isChecked &&
                    (allocationType === "PERCENTAGE" ||
                      allocationType === "PER_UNIT" ||
                      allocationType === "CUSTOM") ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {allocationType === "PERCENTAGE" ? (
                          <div className="space-y-2">
                                <Label htmlFor={`percentage-${contract.id}`}>
                                  Share percentage
                                </Label>
                                <Input
                                  id={`percentage-${contract.id}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={selectedEntry?.percentage ?? ""}
                                  onChange={(event) =>
                                    updateAllocationEntry(
                                      contract.id,
                                      "percentage",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="25.00"
                                  className="field-blank h-11"
                                  disabled={pending || isLocked}
                              />
                            </div>
                          ) : allocationType === "PER_UNIT" ? (
                            <div className="space-y-2">
                              <Label htmlFor={`unitCount-${contract.id}`}>
                                Unit count
                              </Label>
                              <Input
                                id={`unitCount-${contract.id}`}
                                type="number"
                                min="1"
                                step="1"
                                value={selectedEntry?.unitCount ?? ""}
                                onChange={(event) =>
                                  updateAllocationEntry(
                                    contract.id,
                                    "unitCount",
                                    event.target.value,
                                  )
                                }
                                placeholder="1"
                                className="field-blank h-11"
                                disabled={pending || isLocked}
                              />
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label htmlFor={`amount-${contract.id}`}>
                                  Custom amount
                                </Label>
                                <Input
                                  id={`amount-${contract.id}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={selectedEntry?.amount ?? ""}
                                  onChange={(event) =>
                                    updateAllocationEntry(
                                      contract.id,
                                      "amount",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="3000.00"
                                  className="field-blank h-11"
                                  disabled={pending || isLocked}
                                />
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label>Preview split</Label>
                              <div className="field-blank flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground">
                                {preview
                                  ? `${formatCurrency(preview.computedAmount)} · ${preview.percentage.toFixed(2)}%`
                                  : allocationType === "PER_UNIT"
                                    ? "Enter a total amount and unit counts to calculate."
                                    : "Enter a valid share to calculate."}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </label>
                    );
                  })}
                </div>

                {hasSelections ? (
                  <div className="rounded-[1.2rem] border border-border/60 bg-muted/45 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Allocation preview
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          This preview is what will flow into invoice generation
                          once the COSA record is saved.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Computed total
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {formatCurrency(previewTotal)}
                        </p>
                      </div>
                    </div>

                    {previewResult.error ? (
                      <p className="mt-3 text-sm text-destructive">
                        {previewResult.error}
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-2 text-sm">
                        {selectedContracts.map((selectedContract) => {
                          const preview = selectedContract.preview;

                          return (
                            <div
                              key={selectedContract.contract.id}
                              className="flex items-center justify-between gap-4"
                            >
                              <span className="text-muted-foreground">
                                {formatTenantName(
                                  selectedContract.contract.tenant,
                                )}
                              </span>
                              <span className="font-medium text-foreground">
                                {preview
                                  ? `${formatCurrency(preview.computedAmount)} · ${preview.percentage.toFixed(2)}%`
                                  : allocationType === "PER_UNIT"
                                    ? formatUnitLabel(selectedContract.entry.unitCount)
                                  : "Pending"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              {mode === "create" ? "New record" : "Update record"}
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {mode === "create" ? "Create COSA charge" : "Save COSA charge"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Common-area charges are stored once, split across the chosen
              tenant contracts, then consumed by invoice generation exactly one
              time.
            </p>

            <div className="mt-5 space-y-3 rounded-[1.2rem] border border-border/60 bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Selected tenants</span>
                <span className="font-medium text-foreground">
                  {allocationEntries.length}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Allocation mode</span>
                <span className="font-medium text-foreground">
                  {ALLOCATION_TYPE_LABELS[allocationType]}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Preview total</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(previewTotal)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || isLocked || !hasSelections}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                {mode === "create" ? "Create COSA" : "Save changes"}
              </Button>
              <Button
                render={<Link href="/billing/cosa" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to COSA
              </Button>
            </div>
          </div>

          <div className="border-blank rounded-xl p-5">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-primary" />
              <h3 className="font-semibold tracking-[-0.03em]">Split notes</h3>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                <strong className="text-foreground">Equal split</strong> divides
                the total evenly across every selected tenant.
              </p>
              <p>
                <strong className="text-foreground">Percentage</strong> lets you
                enter explicit percentage shares that must total 100%.
              </p>
              <p>
                <strong className="text-foreground">By area</strong> uses each
                contract property&apos;s recorded size automatically.
              </p>
              <p>
                <strong className="text-foreground">Custom amount</strong> lets
                you input exact amounts that must match the total.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
