"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import type { CosaFormState } from "@/app/(dashboard)/billing/actions";
import { calculateCosaAllocations } from "@/lib/billing/cosa";
import { ALLOCATION_TYPES, ALLOCATION_TYPE_LABELS } from "@/lib/form-options";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import { getDescendantPropertyIds } from "@/lib/property-tree";
import { formatUtilityQuantity, getUtilityRateLabel } from "@/lib/utility-units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionRedirect } from "@/components/ui/use-action-redirect";

const initialState: CosaFormState = {};

const selectClassName =
  "select-blank";

type AllocationEntry = {
  entryId: string;
  contractId: string;
  helperLabel: string;
  isHelper: boolean;
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
      cosaDescription: string | null;
      cosaBillingDate: string | null;
    }[];
  }[];
  meterUtilityTypeFilter?: string | null;
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
  templateLock?: {
    templateId: string;
    templateName: string;
  } | null;
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

function getSuggestedBillingDateForReading(readingDate: string) {
  const value = new Date(readingDate);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  value.setUTCDate(value.getUTCDate() + 1);
  return toDateInputValue(value);
}

function formatPreviewValue(params: {
  allocationType: (typeof ALLOCATION_TYPES)[number];
  preview:
    | ReturnType<typeof calculateCosaAllocations>[number]
    | undefined;
  entry: AllocationEntry;
}) {
  const { allocationType, preview, entry } = params;

  if (!preview) {
    if (allocationType === "PER_UNIT") {
      return formatUnitLabel(entry.unitCount);
    }

    if (allocationType === "PERCENTAGE") {
      return `${entry.percentage || "0"}%`;
    }

    if (allocationType === "CUSTOM") {
      return formatCurrency(Number(entry.amount || 0));
    }

    return "Pending";
  }

  if (allocationType === "PER_UNIT") {
    return `${formatCurrency(preview.computedAmount)} · ${formatUnitLabel(entry.unitCount)}`;
  }

  return `${formatCurrency(preview.computedAmount)} · ${preview.percentage.toFixed(2)}%`;
}

function parsePercentageValue(value: string) {
  const parsedValue = Number(value.trim());

  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
}

function roundPercentageValue(value: number) {
  return Number(value.toFixed(2));
}

function formatPercentageValue(value: number) {
  return roundPercentageValue(value).toFixed(2).replace(/\.?0+$/, "");
}

function buildHelperEntryId() {
  return `helper:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function supportsHelperAllocations(
  allocationType: (typeof ALLOCATION_TYPES)[number],
) {
  return allocationType === "PERCENTAGE" || allocationType === "PER_UNIT";
}

function createHelperEntry(): AllocationEntry {
  return {
    entryId: buildHelperEntryId(),
    contractId: "",
    helperLabel: "",
    isHelper: true,
    percentage: "",
    unitCount: "1",
    amount: "",
  };
}

export function CosaForm({
  mode,
  formAction,
  propertyOptions,
  meterOptions,
  meterUtilityTypeFilter = null,
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
  templateLock = null,
}: CosaFormProps) {
  function getEligibleMeterReadings(
    nextMeterId: string,
    activeMeterReadingId = ""
  ) {
    const meter = meterOptions.find((entry) => entry.id === nextMeterId);

    if (!meter) {
      return [];
    }

    return meter.readings.filter(
      (reading) => !reading.cosaId || reading.id === activeMeterReadingId
    );
  }

  function getLatestEligibleMeterReadingId(
    nextMeterId: string,
    activeMeterReadingId = ""
  ) {
    return getEligibleMeterReadings(nextMeterId, activeMeterReadingId)[0]?.id ?? "";
  }

  const [state, action, pending] = useActionState(formAction, initialState);
  useActionRedirect(state.redirectTo);
  const [propertyId, setPropertyId] = useState(initialValues.propertyId);
  const [meterId, setMeterId] = useState(initialValues.meterId);
  const [meterReadingId, setMeterReadingId] = useState(
    () =>
      initialValues.meterReadingId ||
      getLatestEligibleMeterReadingId(initialValues.meterId)
  );
  const [totalAmount, setTotalAmount] = useState(initialValues.totalAmount);
  const [billingDate, setBillingDate] = useState(initialValues.billingDate);
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

  const selectableProperties = useMemo(
    () =>
      propertyOptions.filter(
        (property) =>
          property.id === propertyId ||
          propertyOptions.some(
            (candidate) =>
              candidate.parentPropertyId === property.id &&
              candidate.status !== "ARCHIVED",
          ),
      ),
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
    () =>
      meterOptions.filter(
        (meter) =>
          meter.propertyId === propertyId &&
          (!meterUtilityTypeFilter ||
            meter.utilityType === meterUtilityTypeFilter),
      ),
    [meterOptions, meterUtilityTypeFilter, propertyId],
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
  const consumedReadings = useMemo(() => {
    if (!selectedMeter) {
      return [];
    }

    return selectedMeter.readings.filter(
      (reading) => Boolean(reading.cosaId) && reading.id !== meterReadingId,
    );
  }, [meterReadingId, selectedMeter]);
  const latestConsumedReading = consumedReadings[0] ?? null;
  const latestAvailableReading = availableReadings[0] ?? null;
  const isLatestReadingApplied =
    Boolean(selectedMeterReading) &&
    selectedMeterReading?.id === latestAvailableReading?.id;
  const suggestedBillingDate = selectedMeterReading
    ? getSuggestedBillingDateForReading(selectedMeterReading.readingDate)
    : "";
  const lastSuggestedBillingDateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!suggestedBillingDate) {
      lastSuggestedBillingDateRef.current = null;
      return;
    }

    setBillingDate((currentBillingDate) => {
      const lastSuggestedBillingDate = lastSuggestedBillingDateRef.current;
      const shouldReplace =
        currentBillingDate.trim() === "" ||
        currentBillingDate === initialValues.billingDate ||
        (lastSuggestedBillingDate != null &&
          currentBillingDate === lastSuggestedBillingDate);

      return shouldReplace ? suggestedBillingDate : currentBillingDate;
    });
    lastSuggestedBillingDateRef.current = suggestedBillingDate;
  }, [initialValues.billingDate, suggestedBillingDate]);

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
            const contract = entry.contractId
              ? contractLookup.get(entry.contractId)
              : undefined;

              return {
                contractId: entry.entryId,
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
    const nextEntries = supportsHelperAllocations(nextType)
      ? currentEntries
      : currentEntries.filter((entry) => !entry.isHelper);

    if (nextType === "PERCENTAGE") {
      const equalPercentages = buildEqualPercentages(nextEntries.length);

      return nextEntries.map((entry, index) => ({
        ...entry,
        percentage: equalPercentages[index] ?? entry.percentage,
        unitCount: "",
        amount: "",
      }));
    }

    if (nextType === "CUSTOM") {
      const equalAmounts = buildEqualAmounts(
        totalAmount,
        nextEntries.length,
      );

      return nextEntries.map((entry, index) => ({
        ...entry,
        percentage: "",
        unitCount: "",
        amount: equalAmounts[index] ?? entry.amount,
      }));
    }

    if (nextType === "PER_UNIT") {
      return nextEntries.map((entry) => ({
        ...entry,
        percentage: "",
        unitCount:
          entry.unitCount && Number(entry.unitCount) > 0 ? entry.unitCount : "1",
        amount: "",
      }));
    }

    return nextEntries.map((entry) => ({
      ...entry,
      percentage: "",
      unitCount: "",
      amount: "",
    }));
  }

  function handlePropertyChange(nextPropertyId: string) {
    setPropertyId(nextPropertyId);
    let nextMeterId = "";

    setMeterId((currentMeterId) => {
      if (!currentMeterId) {
        return currentMeterId;
      }

      const selectedMeter = meterOptions.find(
        (meter) => meter.id === currentMeterId,
      );

      nextMeterId =
        selectedMeter && selectedMeter.propertyId === nextPropertyId
          ? currentMeterId
          : "";

      return nextMeterId;
    });
    setMeterReadingId(
      nextMeterId ? getLatestEligibleMeterReadingId(nextMeterId) : ""
    );

    const nextScopeIds = getDescendantPropertyIds(
      nextPropertyId,
      propertyOptions,
    );

    setAllocationEntries((currentEntries) =>
      currentEntries.filter((entry) => {
        if (entry.isHelper) {
          return true;
        }

        const contract = contractLookup.get(entry.contractId);
        return contract ? nextScopeIds.has(contract.property.id) : false;
      }),
    );
  }

  function handleMeterChange(nextMeterId: string) {
    setMeterId(nextMeterId);
    setMeterReadingId(
      nextMeterId ? getLatestEligibleMeterReadingId(nextMeterId) : ""
    );
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
            entryId: contractId,
            contractId,
            helperLabel: "",
            isHelper: false,
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
    entryId: string,
    key: "helperLabel" | "percentage" | "unitCount" | "amount",
    value: string,
  ) {
    setAllocationEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.entryId === entryId
          ? {
              ...entry,
              [key]: value,
            }
          : entry,
      ),
    );
  }

  function addHelperEntry() {
    setAllocationEntries((currentEntries) =>
      rehydrateEntriesForType(allocationType, [
        ...currentEntries,
        createHelperEntry(),
      ]),
    );
  }

  function removeHelperEntry(entryId: string) {
    setAllocationEntries((currentEntries) =>
      currentEntries.filter((entry) => entry.entryId !== entryId),
    );
  }

  const serializedAllocations = JSON.stringify(
    allocationEntries.map((entry) => ({
      entryId: entry.entryId,
      contractId: entry.contractId,
      helperLabel: entry.helperLabel,
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

  const selectedParticipants = allocationEntries.flatMap((entry) => {
    const contract = entry.contractId
      ? contractLookup.get(entry.contractId) ?? null
      : null;

    if (!entry.isHelper && !contract) {
      return [];
    }

    return [
      {
        entry,
        contract,
        preview: previewLookup.get(entry.entryId),
        label: entry.isHelper
          ? entry.helperLabel.trim() || "Ghost helper"
          : formatTenantName(contract!.tenant),
      },
    ];
  });

  const previewTotal = previewResult.allocations.reduce(
    (sum, allocation) => sum + allocation.computedAmount,
    0,
  );
  const totalPercentage = allocationEntries.reduce(
    (sum, entry) => sum + parsePercentageValue(entry.percentage),
    0,
  );
  const percentageBalance = roundPercentageValue(100 - totalPercentage);
  const contractAllocationEntries = allocationEntries.filter(
    (entry) => !entry.isHelper && entry.contractId,
  );
  const helperAllocationEntries = allocationEntries.filter(
    (entry) => entry.isHelper,
  );
  const hasSelections = allocationEntries.length > 0;
  const hasTenantSelections = contractAllocationEntries.length > 0;
  const percentageStatus =
    allocationType !== "PERCENTAGE" || !hasSelections
      ? null
      : percentageBalance < -0.01
        ? `${formatPercentageValue(Math.abs(percentageBalance))}% over 100%.`
        : Math.abs(percentageBalance) <= 0.01
          ? "100% assigned."
          : `${formatPercentageValue(percentageBalance)}% left to assign.`;
  const isLocked = Boolean(lockedReason);
  const isTemplateLocked = mode === "create" && Boolean(templateLock);
  const isAllocationEditingLocked = pending || isLocked || isTemplateLocked;

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="allocations"
        value={serializedAllocations}
        readOnly
      />
      <input type="hidden" name="meterReadingId" value={meterReadingId} readOnly />
      {isTemplateLocked ? (
        <>
          <input type="hidden" name="propertyId" value={propertyId} readOnly />
          <input type="hidden" name="meterId" value={meterId} readOnly />
          <input
            type="hidden"
            name="allocationType"
            value={allocationType}
            readOnly
          />
        </>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="border-blank space-y-6 rounded-xl p-6">
            <div className="rounded-[1.2rem] border border-border/60 bg-background/55 p-4">
              <p className="text-sm font-medium">COSA billing flow</p>
              <ol className="mt-3 space-y-2 pl-5 text-sm leading-6 text-muted-foreground list-decimal">
                <li>Choose property, then optionally link shared meter.</li>
                <li>If shared meter is linked, latest unread reading is auto-applied and still editable.</li>
                <li>If no shared meter is linked, enter monthly COSA amount manually.</li>
                <li>Review tenant split, save COSA, then run invoice generation for matching billing cycle.</li>
                <li>Saved uninvoiced COSA allocations are included automatically when billing date falls inside selected invoice cycle.</li>
              </ol>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Meter reading is only needed for meter-backed COSA. Manual salary-style COSA like security guard or maintenance can stay fully manual.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="propertyId">Property</Label>
                <select
                  id="propertyId"
                  name="propertyId"
                  value={propertyId}
                  onChange={(event) => handlePropertyChange(event.target.value)}
                  className={selectClassName}
                  disabled={pending || isLocked || isTemplateLocked}
                >
                  <option value="">Select a property</option>
                  {selectableProperties.map((property) => (
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
                  disabled={pending || isLocked || isTemplateLocked || !propertyId}
                >
                  <option value="">No linked meter</option>
                  {visibleMeters.map((meter) => (
                    <option key={meter.id} value={meter.id}>
                      {meter.meterCode} ·{" "}
                      {meter.utilityType.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                {isTemplateLocked && !meterId ? (
                  <p className="text-sm text-muted-foreground">
                    This template is manual and does not use a shared meter.
                  </p>
                ) : null}
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
                  {availableReadings.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {selectedMeterReading
                        ? isLatestReadingApplied
                          ? "Using latest unread reading from this shared meter. You can switch to another unread reading or return to manual amount."
                          : "Using selected unread reading from this shared meter. You can switch readings or return to manual amount."
                        : "Manual amount mode is active. Choose an unread reading above if this COSA should follow shared-meter data."}
                    </p>
                  ) : latestConsumedReading ? (
                    <div className="rounded-[1rem] border border-border/60 bg-muted/45 px-3 py-3 text-sm leading-6 text-muted-foreground">
                      <p className="font-medium text-foreground">
                        This shared-meter reading is already linked to a saved COSA.
                      </p>
                      <p className="mt-2">
                        Latest linked reading: {formatDate(latestConsumedReading.readingDate)} ·{" "}
                        {selectedMeter
                          ? formatUtilityQuantity(
                              selectedMeter.utilityType as Parameters<
                                typeof formatUtilityQuantity
                              >[0],
                              latestConsumedReading.consumption,
                            )
                          : latestConsumedReading.consumption}{" "}
                        · {formatCurrency(Number(latestConsumedReading.totalAmount))}
                      </p>
                      <p className="mt-2">
                        Linked COSA: {latestConsumedReading.cosaDescription ?? "Saved COSA"} ·{" "}
                        billing date{" "}
                        {latestConsumedReading.cosaBillingDate
                          ? formatDate(latestConsumedReading.cosaBillingDate)
                          : "not set"}
                      </p>
                      <Button
                        render={
                          <Link
                            href={`/billing/cosa/${latestConsumedReading.cosaId}/edit`}
                          />
                        }
                        variant="outline"
                        className="button-blank mt-3 rounded-full"
                      >
                        <ArrowLeft className="rotate-180" />
                        Open linked COSA
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-[1rem] border border-border/60 bg-muted/45 px-3 py-3 text-sm leading-6 text-muted-foreground">
                      No unread readings are available for this shared meter yet. You can still save a manual COSA amount, and invoice generation will bill that manual amount instead of meter-derived data.
                    </div>
                  )}
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
                  readOnly={isTemplateLocked}
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
                    ? "This amount is locked to the selected shared-meter reading."
                    : "Enter the monthly shared-charge total manually, or choose a shared-meter reading above."}
                </p>
                <FieldError message={state.errors?.totalAmount?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingDate">Billing date</Label>
                <Input
                  id="billingDate"
                  name="billingDate"
                  type="date"
                  value={billingDate}
                  onChange={(event) => setBillingDate(event.target.value)}
                  className="field-blank h-11"
                  disabled={pending || isLocked}
                />
                {selectedMeterReading ? (
                  <p className="text-sm text-muted-foreground">
                    Suggested from the selected shared-meter reading: next-day
                    billing anchor.
                  </p>
                ) : null}
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
                  disabled={pending || isLocked || isTemplateLocked}
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
                {isTemplateLocked ? (
                  <p className="text-sm text-muted-foreground">
                    Allocation mode is locked to the selected template here.
                  </p>
                ) : null}
              </div>
            </div>

            {lockedReason ? (
              <div className="rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
                {lockedReason}
              </div>
            ) : null}

            {isTemplateLocked && templateLock ? (
              <div className="rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Template defaults from{" "}
                <span className="font-medium text-foreground">
                  {templateLock.templateName}
                </span>{" "}
                are locked here so this screen cannot accidentally change the
                template setup. Edit the template directly if you need to
                change its participants, labels, or split rules.
                <Link
                  href={`/billing/cosa/templates/${templateLock.templateId}/edit`}
                  className="ml-2 inline-flex font-medium text-primary hover:underline"
                >
                  Edit template
                </Link>
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
                {isTemplateLocked ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Tenant split is locked to the selected template on this
                    screen.
                  </p>
                ) : null}
              </div>
              <div className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground">
                {contractAllocationEntries.length} tenants
                {helperAllocationEntries.length > 0
                  ? ` · ${helperAllocationEntries.length} helpers`
                  : ""}
              </div>
            </div>

            <FieldError message={state.errors?.allocations?.[0]} />
            {percentageStatus ? (
              <p
                className={`mt-2 text-sm ${
                  percentageBalance < -0.01
                    ? "text-destructive"
                    : Math.abs(percentageBalance) <= 0.01
                      ? "text-muted-foreground"
                      : "text-primary"
                }`}
              >
                {percentageStatus}
              </p>
            ) : null}

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
                              disabled={isAllocationEditingLocked}
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
                            <p>
                              {allocationType === "PER_UNIT"
                                ? formatUnitLabel(selectedEntry?.unitCount ?? "")
                                : `${preview.percentage.toFixed(2)}%`}
                            </p>
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
                                  disabled={isAllocationEditingLocked}
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
                                disabled={isAllocationEditingLocked}
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
                                  disabled={isAllocationEditingLocked}
                                />
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label>Preview split</Label>
                              <div className="field-blank flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground">
                                {preview
                                  ? formatPreviewValue({
                                      allocationType,
                                      preview,
                                      entry: selectedEntry!,
                                    })
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

                {supportsHelperAllocations(allocationType) ? (
                  <div className="rounded-[1.2rem] border border-border/60 bg-muted/35 px-4 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Ghost helpers
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Add non-billed helper rows to absorb leftover percentage or unit weight. They stay on this COSA record, but invoice generation ignores them.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addHelperEntry}
                        disabled={isAllocationEditingLocked}
                      >
                        <Plus />
                        Add helper
                      </Button>
                    </div>

                    {helperAllocationEntries.length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No helper rows yet.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {helperAllocationEntries.map((entry) => {
                          const preview = previewLookup.get(entry.entryId);

                          return (
                            <div
                              key={entry.entryId}
                              className="border-blank rounded-xl p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-foreground">
                                    {entry.helperLabel.trim() || "Ghost helper"}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Helper share excluded from tenant billing.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeHelperEntry(entry.entryId)}
                                  disabled={isAllocationEditingLocked}
                                >
                                  <Trash2 />
                                  Remove
                                </Button>
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`helper-label-${entry.entryId}`}>
                                    Helper label
                                  </Label>
                                  <Input
                                    id={`helper-label-${entry.entryId}`}
                                    value={entry.helperLabel}
                                    onChange={(event) =>
                                      updateAllocationEntry(
                                        entry.entryId,
                                        "helperLabel",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Owner reserve"
                                    className="field-blank h-11"
                                    disabled={isAllocationEditingLocked}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label
                                    htmlFor={`${allocationType === "PERCENTAGE" ? "helper-percentage" : "helper-unit"}-${entry.entryId}`}
                                  >
                                    {allocationType === "PERCENTAGE"
                                      ? "Share percentage"
                                      : "Unit count"}
                                  </Label>
                                  <Input
                                    id={`${allocationType === "PERCENTAGE" ? "helper-percentage" : "helper-unit"}-${entry.entryId}`}
                                    type="number"
                                    min={allocationType === "PERCENTAGE" ? "0" : "1"}
                                    step={allocationType === "PERCENTAGE" ? "0.01" : "1"}
                                    value={
                                      allocationType === "PERCENTAGE"
                                        ? entry.percentage
                                        : entry.unitCount
                                    }
                                    onChange={(event) =>
                                      updateAllocationEntry(
                                        entry.entryId,
                                        allocationType === "PERCENTAGE"
                                          ? "percentage"
                                          : "unitCount",
                                        event.target.value,
                                      )
                                    }
                                    placeholder={
                                      allocationType === "PERCENTAGE"
                                        ? "10.00"
                                        : "1"
                                    }
                                    className="field-blank h-11"
                                    disabled={isAllocationEditingLocked}
                                  />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                  <Label>Preview split</Label>
                                  <div className="field-blank flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground">
                                    {preview
                                      ? formatPreviewValue({
                                          allocationType,
                                          preview,
                                          entry,
                                        })
                                      : allocationType === "PERCENTAGE"
                                        ? `${entry.percentage || "0"}% helper share`
                                        : `${formatUnitLabel(entry.unitCount)} helper weight`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

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
                        {selectedParticipants.map((participant) => {
                          const preview = participant.preview;

                          return (
                            <div
                              key={participant.entry.entryId}
                              className="flex items-center justify-between gap-4"
                            >
                              <span className="text-muted-foreground">
                                {participant.label}
                              </span>
                              <span className="font-medium text-foreground">
                                {formatPreviewValue({
                                  allocationType,
                                  preview,
                                  entry: participant.entry,
                                })}
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
                  {contractAllocationEntries.length}
                </span>
              </div>
              {helperAllocationEntries.length > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Ghost helpers</span>
                  <span className="font-medium text-foreground">
                    {helperAllocationEntries.length}
                  </span>
                </div>
              ) : null}
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
                disabled={pending || isLocked || !hasTenantSelections}
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
