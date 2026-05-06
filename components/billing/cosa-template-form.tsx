"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, LoaderCircle, Save } from "lucide-react";
import type { CosaTemplateFormState } from "@/app/(dashboard)/billing/actions";
import { calculateCosaAllocations } from "@/lib/billing/cosa";
import { ALLOCATION_TYPES, ALLOCATION_TYPE_LABELS } from "@/lib/form-options";
import { formatCurrency } from "@/lib/format";
import { getDescendantPropertyIds } from "@/lib/property-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CosaTemplateFormState = {};

const selectClassName = "select-blank";

type AllocationEntry = {
  contractId: string;
  percentage: string;
  unitCount: string;
  amount: string;
};

type CosaTemplateFormProps = {
  mode: "create" | "edit";
  formAction: (
    state: CosaTemplateFormState,
    formData: FormData,
  ) => Promise<CosaTemplateFormState>;
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
    name: string;
    allocationType: (typeof ALLOCATION_TYPES)[number];
    defaultAmount: string;
    isActive: boolean;
    allocations: AllocationEntry[];
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function formatTenantName(
  tenant: CosaTemplateFormProps["contractOptions"][number]["tenant"],
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

export function CosaTemplateForm({
  mode,
  formAction,
  propertyOptions,
  meterOptions,
  contractOptions,
  initialValues = {
    propertyId: "",
    meterId: "",
    name: "",
    allocationType: "PERCENTAGE",
    defaultAmount: "",
    isActive: true,
    allocations: [],
  },
}: CosaTemplateFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [propertyId, setPropertyId] = useState(initialValues.propertyId);
  const [meterId, setMeterId] = useState(initialValues.meterId);
  const [defaultAmount, setDefaultAmount] = useState(
    initialValues.defaultAmount,
  );
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

  const contractLookup = useMemo(
    () => new Map(contractOptions.map((contract) => [contract.id, contract])),
    [contractOptions],
  );

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
        defaultAmount,
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
          entry.unitCount && Number(entry.unitCount) > 0
            ? entry.unitCount
            : "1",
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

  const previewResult = useMemo(() => {
    if (
      !defaultAmount ||
      Number(defaultAmount) <= 0 ||
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
          totalAmount: Number(defaultAmount),
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
  }, [allocationEntries, allocationType, contractLookup, defaultAmount]);

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

  const hasSelections = allocationEntries.length > 0;

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="allocations"
        value={serializedAllocations}
        readOnly
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="border-blank space-y-6 rounded-xl p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Template name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={initialValues.name}
                  placeholder="Common Water"
                  className="field-blank h-11"
                  disabled={pending}
                />
                <FieldError message={state.errors?.name?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyId">Property</Label>
                <select
                  id="propertyId"
                  name="propertyId"
                  value={propertyId}
                  onChange={(event) => handlePropertyChange(event.target.value)}
                  className={selectClassName}
                  disabled={pending}
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
                <Label htmlFor="meterId">Default shared meter</Label>
                <select
                  id="meterId"
                  name="meterId"
                  value={meterId}
                  onChange={(event) => setMeterId(event.target.value)}
                  className={selectClassName}
                  disabled={pending || !propertyId}
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

              <div className="space-y-2">
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
                  disabled={pending}
                >
                  {ALLOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ALLOCATION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultAmount">Default monthly amount</Label>
                <Input
                  id="defaultAmount"
                  name="defaultAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={defaultAmount}
                  onChange={(event) => setDefaultAmount(event.target.value)}
                  placeholder="Optional"
                  className="field-blank h-11"
                  disabled={pending}
                />
                <FieldError message={state.errors?.defaultAmount?.[0]} />
                <p className="text-sm text-muted-foreground">
                  Optional. If set, new monthly COSA records will start with
                  this amount.
                </p>
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
                    <span className="text-sm font-medium">
                      Template is active
                    </span>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Active templates stay available when creating future
                      monthly COSA records.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {state.message ? (
              <div className="rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
                {state.message}
              </div>
            ) : null}
          </div>

          <div className="border-blank rounded-xl p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.04em]">
                  Default tenant allocation
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Pick the contracts that usually share this COSA charge. New
                  monthly COSA entries can copy this setup in one step.
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
                              disabled={pending}
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
                                Default:{" "}
                                <span className="font-medium text-foreground">
                                  {preview
                                    ? formatCurrency(preview.computedAmount)
                                    : allocationType === "PERCENTAGE"
                                      ? `${selectedEntry?.percentage || "0"}%`
                                      : allocationType === "PER_UNIT"
                                        ? formatUnitLabel(
                                            selectedEntry?.unitCount ?? "",
                                          )
                                        : "Ready"}
                                </span>
                              </p>
                              {preview ? (
                                <p>{preview.percentage.toFixed(2)}%</p>
                              ) : allocationType === "PER_UNIT" &&
                                selectedEntry ? (
                                <p>
                                  {formatUnitLabel(selectedEntry.unitCount)}
                                </p>
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
                                  Default percentage
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
                                  disabled={pending}
                                />
                              </div>
                            ) : allocationType === "PER_UNIT" ? (
                              <div className="space-y-2">
                                <Label htmlFor={`unitCount-${contract.id}`}>
                                  Default unit count
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
                                  disabled={pending}
                                />
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Label htmlFor={`amount-${contract.id}`}>
                                  Default amount
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
                                  disabled={pending}
                                />
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label>Preview split</Label>
                              <div className="field-blank flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground">
                                {preview
                                  ? `${formatCurrency(preview.computedAmount)} · ${preview.percentage.toFixed(2)}%`
                                  : allocationType === "PERCENTAGE"
                                    ? `${selectedEntry?.percentage || "0"}% default share`
                                    : allocationType === "PER_UNIT"
                                      ? `${formatUnitLabel(selectedEntry?.unitCount ?? "")} default weight`
                                      : "Set a default monthly amount to preview."}
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
                          Template preview
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          These defaults are copied into new monthly COSA
                          records, then can still be adjusted before saving the
                          month.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Default total
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {defaultAmount
                            ? formatCurrency(Number(defaultAmount))
                            : "Not set"}
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
                                  : allocationType === "PERCENTAGE"
                                    ? `${selectedContract.entry.percentage || "0"}%`
                                    : allocationType === "PER_UNIT"
                                      ? formatUnitLabel(
                                          selectedContract.entry.unitCount,
                                        )
                                      : allocationType === "CUSTOM"
                                        ? formatCurrency(
                                            Number(
                                              selectedContract.entry.amount ||
                                                0,
                                            ),
                                          )
                                        : "Ready"}
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
              {mode === "create" ? "New template" : "Update template"}
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {mode === "create"
                ? "Create COSA template"
                : "Save COSA template"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Templates keep the recurring participants and split logic in one
              reusable place. Future monthly COSA records can start from this
              default setup.
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
                <span className="text-muted-foreground">Default amount</span>
                <span className="font-medium text-foreground">
                  {defaultAmount
                    ? formatCurrency(Number(defaultAmount))
                    : "Not set"}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || !hasSelections}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                {mode === "create" ? "Create template" : "Save changes"}
              </Button>
              <Button
                render={<Link href="/billing/cosa/templates" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to templates
              </Button>
            </div>
          </div>

          <div className="border-blank rounded-xl p-5">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-primary" />
              <h3 className="font-semibold tracking-[-0.03em]">
                Template notes
              </h3>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                Save the common tenant split once here, then reuse it each month
                from the template list.
              </p>
              <p>
                Monthly COSA records copy these defaults as a snapshot, so later
                template edits do not rewrite old billing history.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
