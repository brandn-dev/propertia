"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Plus, Save } from "lucide-react";
import type { MeterReadingFormState } from "@/app/(dashboard)/utilities/actions";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AppRole } from "@/lib/auth/roles";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import {
  formatUtilityQuantity,
  getUtilityRateLabel,
  getUtilityReadingLabel,
} from "@/lib/utility-units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "select-blank";

const initialState: MeterReadingFormState = {};

type MeterOption = {
  id: string;
  meterCode: string;
  utilityType: keyof typeof UTILITY_TYPE_LABELS;
  isShared: boolean;
  tenant: {
    id: string;
    type: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  } | null;
  property: {
    id: string;
    name: string;
    propertyCode: string;
  };
  readings: {
    id: string;
    readingDate: string;
    currentReading: string;
    isBilled?: boolean;
  }[];
};

type MeterReadingFormProps = {
  mode?: "create" | "edit";
  formAction: (
    state: MeterReadingFormState,
    formData: FormData
  ) => Promise<MeterReadingFormState>;
  meterOptions: MeterOption[];
  role: AppRole;
  initialValues?: {
    readingId?: string;
    meterId: string;
    readingDate: string;
    currentReading: string;
    ratePerUnit: string;
  };
};

type ScopeOption = {
  key: string;
  label: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function formatTenantLabel(tenant: NonNullable<MeterOption["tenant"]>) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

function getScopeKey(meter: MeterOption) {
  if (meter.tenant) {
    return `tenant:${meter.tenant.id}`;
  }

  if (meter.isShared) {
    return `property:${meter.property.id}`;
  }

  return "";
}

export function MeterReadingForm({
  mode = "create",
  formAction,
  meterOptions,
  role,
  initialValues = {
    readingId: "",
    meterId: "",
    readingDate: new Date().toISOString().slice(0, 10),
    currentReading: "",
    ratePerUnit: "",
  },
}: MeterReadingFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const isEditMode = mode === "edit";

  const initialMeter =
    meterOptions.find((meter) => meter.id === initialValues.meterId) ?? null;
  const [selectedScopeKey, setSelectedScopeKey] = useState(
    initialMeter ? getScopeKey(initialMeter) : ""
  );
  const [selectedMeterId, setSelectedMeterId] = useState(initialValues.meterId);
  const [readingDate, setReadingDate] = useState(initialValues.readingDate);
  const [currentReading, setCurrentReading] = useState(initialValues.currentReading);
  const [ratePerUnit, setRatePerUnit] = useState(initialValues.ratePerUnit);

  const tenantScopeOptions = useMemo(() => {
    const tenants = new Map<string, ScopeOption>();

    for (const meter of meterOptions) {
      if (!meter.tenant || tenants.has(meter.tenant.id)) {
        continue;
      }

      tenants.set(meter.tenant.id, {
        key: `tenant:${meter.tenant.id}`,
        label: formatTenantLabel(meter.tenant),
      });
    }

    return [...tenants.values()].sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }, [meterOptions]);

  const sharedScopeOptions = useMemo(() => {
    const properties = new Map<string, ScopeOption>();

    for (const meter of meterOptions) {
      if (!meter.isShared || meter.tenant || properties.has(meter.property.id)) {
        continue;
      }

      properties.set(meter.property.id, {
        key: `property:${meter.property.id}`,
        label: `${meter.property.name} shared`,
      });
    }

    return [...properties.values()].sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }, [meterOptions]);

  const availableMeters = useMemo(
    () =>
      selectedScopeKey
        ? meterOptions.filter((meter) => getScopeKey(meter) === selectedScopeKey)
        : [],
    [meterOptions, selectedScopeKey]
  );

  const selectedMeter = useMemo(
    () => meterOptions.find((meter) => meter.id === selectedMeterId) ?? null,
    [meterOptions, selectedMeterId]
  );

  const readingHistory = useMemo(() => {
    if (!selectedMeter) {
      return [];
    }

    return [...selectedMeter.readings]
      .filter((reading) => reading.id !== initialValues.readingId)
      .sort((left, right) => left.readingDate.localeCompare(right.readingDate));
  }, [initialValues.readingId, selectedMeter]);

  const previousReadingEntry = useMemo(() => {
    if (!selectedMeter || !readingDate) {
      return null;
    }

    return (
      [...readingHistory]
        .reverse()
        .find((reading) => reading.readingDate < readingDate) ?? null
    );
  }, [readingDate, readingHistory, selectedMeter]);

  const nextReadingEntry = useMemo(() => {
    if (!selectedMeter || !readingDate) {
      return null;
    }

    return readingHistory.find((reading) => reading.readingDate > readingDate) ?? null;
  }, [readingDate, readingHistory, selectedMeter]);

  const conflictingDateEntry = useMemo(() => {
    if (!selectedMeter || !readingDate) {
      return null;
    }

    return readingHistory.find((reading) => reading.readingDate === readingDate) ?? null;
  }, [readingDate, readingHistory, selectedMeter]);

  const previousReadingValue = previousReadingEntry
    ? Number(previousReadingEntry.currentReading)
    : 0;
  const currentReadingValue = currentReading === "" ? null : Number(currentReading);
  const ratePerUnitValue = ratePerUnit === "" ? null : Number(ratePerUnit);
  const computedConsumption =
    currentReadingValue !== null && !Number.isNaN(currentReadingValue)
      ? currentReadingValue - previousReadingValue
      : null;
  const computedTotalAmount =
    computedConsumption !== null &&
    !Number.isNaN(computedConsumption) &&
    ratePerUnitValue !== null &&
    !Number.isNaN(ratePerUnitValue)
      ? computedConsumption * ratePerUnitValue
      : null;
  const hasScopeOptions =
    tenantScopeOptions.length > 0 || sharedScopeOptions.length > 0;
  const hasTenantOptions = tenantScopeOptions.length > 0;
  const currentReadingLabel = selectedMeter
    ? getUtilityReadingLabel(selectedMeter.utilityType)
    : "Current reading";
  const rateLabel = selectedMeter
    ? getUtilityRateLabel(selectedMeter.utilityType)
    : "Rate per unit";

  function handleScopeChange(nextScopeKey: string) {
    setSelectedScopeKey(nextScopeKey);

    const nextMeters = meterOptions.filter(
      (meter) => getScopeKey(meter) === nextScopeKey
    );

    if (!nextMeters.some((meter) => meter.id === selectedMeterId)) {
      setSelectedMeterId("");
    }
  }

  function formatReadingValue(value: number) {
    return value.toFixed(2);
  }

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-xl p-6">
          <div className="grid gap-5 md:grid-cols-2">
            {isEditMode ? (
              <>
                <input type="hidden" name="meterId" value={selectedMeterId} />
                <div className="field-blank md:col-span-2 rounded-[1.2rem] border bg-background/60 px-4 py-4">
                  {selectedMeter ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {selectedMeter.tenant
                            ? `${formatTenantLabel(selectedMeter.tenant)} · ${selectedMeter.meterCode}`
                            : `${selectedMeter.property.name} shared · ${selectedMeter.meterCode}`}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {UTILITY_TYPE_LABELS[selectedMeter.utilityType]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {selectedMeter.property.propertyCode}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Editing keeps the reading on the same meter. Date, current
                        reading, and rate can be corrected here.
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="scopeKey">Tenant / scope</Label>
                  <select
                    id="scopeKey"
                    value={selectedScopeKey}
                    onChange={(event) => handleScopeChange(event.target.value)}
                    className={selectClassName}
                    disabled={!hasScopeOptions}
                  >
                    <option value="">
                      {hasScopeOptions
                        ? hasTenantOptions
                          ? "Select a tenant"
                          : "Select a shared property"
                        : "No tenant meters available"}
                    </option>
                    {tenantScopeOptions.length > 0 ? (
                      <optgroup label="Tenant meters">
                        {tenantScopeOptions.map((scope) => (
                          <option key={scope.key} value={scope.key}>
                            {scope.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {sharedScopeOptions.length > 0 ? (
                      <optgroup label="Shared property meters">
                        {sharedScopeOptions.map((scope) => (
                          <option key={scope.key} value={scope.key}>
                            {scope.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                  {sharedScopeOptions.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Shared property meters stay available here under their property
                      scope, but dedicated meter capture now starts from tenant
                      selection.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="meterId">Assigned meter</Label>
                  <select
                    id="meterId"
                    name="meterId"
                    value={selectedMeterId}
                    onChange={(event) => setSelectedMeterId(event.target.value)}
                    className={selectClassName}
                    disabled={!selectedScopeKey || availableMeters.length === 0}
                  >
                    <option value="">
                      {selectedScopeKey
                        ? availableMeters.length > 0
                          ? "Select a meter"
                          : "No meters under this tenant or scope"
                        : "Select a tenant or scope first"}
                    </option>
                    {availableMeters.map((meter) => (
                      <option key={meter.id} value={meter.id}>
                        {meter.meterCode} · {UTILITY_TYPE_LABELS[meter.utilityType]}
                      </option>
                    ))}
                  </select>
                  <FieldError message={state.errors?.meterId?.[0]} />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="readingDate">Reading date</Label>
              <Input
                id="readingDate"
                name="readingDate"
                type="date"
                value={readingDate}
                onChange={(event) => setReadingDate(event.target.value)}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.readingDate?.[0]} />
              {conflictingDateEntry ? (
                <p className="text-xs text-destructive">
                  Another reading already exists on this meter for that date.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentReading">{currentReadingLabel}</Label>
              <Input
                id="currentReading"
                name="currentReading"
                type="number"
                min="0"
                step="0.01"
                value={currentReading}
                onChange={(event) => setCurrentReading(event.target.value)}
                placeholder="1250.50"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.currentReading?.[0]} />
              {nextReadingEntry && selectedMeter ? (
                <p className="text-xs text-muted-foreground">
                  Next reading is{" "}
                  {formatUtilityQuantity(
                    selectedMeter.utilityType,
                    nextReadingEntry.currentReading
                  )}{" "}
                  on {formatDate(nextReadingEntry.readingDate)}.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="previousReading">Previous reading</Label>
              <Input
                id="previousReading"
                type="text"
                value={
                  selectedMeter
                    ? formatUtilityQuantity(
                        selectedMeter.utilityType,
                        formatReadingValue(previousReadingValue)
                      )
                    : ""
                }
                readOnly
                disabled
                className="field-blank h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ratePerUnit">{rateLabel}</Label>
              <Input
                id="ratePerUnit"
                name="ratePerUnit"
                type="number"
                min="0"
                step="0.01"
                value={ratePerUnit}
                onChange={(event) => setRatePerUnit(event.target.value)}
                placeholder="12.35"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.ratePerUnit?.[0]} />
            </div>

            <div className="field-blank md:col-span-2 rounded-[1.2rem] border bg-background/60 px-4 py-4">
              {selectedMeter ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {selectedMeter.tenant
                        ? `${formatTenantLabel(selectedMeter.tenant)} · ${selectedMeter.meterCode}`
                        : `${selectedMeter.property.name} shared · ${selectedMeter.meterCode}`}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {UTILITY_TYPE_LABELS[selectedMeter.utilityType]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedMeter.isShared ? "Shared" : "Dedicated"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedMeter.property.propertyCode}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {previousReadingEntry
                      ? `Previous reading: ${formatUtilityQuantity(selectedMeter.utilityType, previousReadingEntry.currentReading)} on ${formatDate(previousReadingEntry.readingDate)}.`
                      : "No previous reading found. This will be treated as the initial reading for the selected meter."}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>
                      Computed usage:{" "}
                      {computedConsumption !== null && !Number.isNaN(computedConsumption)
                        ? formatUtilityQuantity(
                            selectedMeter.utilityType,
                            formatReadingValue(computedConsumption)
                          )
                        : "Waiting for current reading"}
                    </span>
                    <span>
                      Computed charge:{" "}
                      {computedTotalAmount !== null && !Number.isNaN(computedTotalAmount)
                        ? formatCurrency(computedTotalAmount)
                        : "Waiting for rate"}
                    </span>
                  </div>
                  {computedConsumption !== null && computedConsumption < 0 ? (
                    <p className="text-xs text-destructive">
                      Current reading cannot be lower than the previous reading.
                    </p>
                  ) : null}
                  {nextReadingEntry &&
                  currentReadingValue !== null &&
                  !Number.isNaN(currentReadingValue) &&
                  currentReadingValue > Number(nextReadingEntry.currentReading) ? (
                    <p className="text-xs text-destructive">
                      Current reading cannot exceed the next recorded reading.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  {isEditMode
                    ? "This reading is no longer attached to an editable meter."
                    : "Select a tenant first, then choose one of the meters assigned to that tenant before recording the next capture. Shared property meters stay available under their own scope when needed."}
                </p>
              )}
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
              New reading
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Capture utility reading
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {isEditMode
                ? "Correct the reading date, current reading, or rate. Previous reading, usage, and total charge are recalculated automatically while you edit."
                : "Choose the tenant first, then record the next chronological reading for one of that tenant&apos;s assigned meters. The system calculates previous reading, consumption, and total charge automatically."}
            </p>

            {!hasScopeOptions ? (
              <div className="mt-4 rounded-[1.2rem] border border-dashed border-border/80 bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
                {role === "ADMIN"
                  ? "No tenant meters are available yet. Assign a meter to a tenant first, then come back here to record the first reading."
                  : "No tenant meters are available yet. Ask an administrator to assign meters before capturing readings."}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || !selectedMeterId}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                {isEditMode ? "Save reading" : "Record reading"}
              </Button>
              {!hasScopeOptions && role === "ADMIN" ? (
                <Button
                  render={<Link href="/utilities/meters/new" />}
                  variant="outline"
                  size="lg"
                  className="button-blank h-11 rounded-xl"
                >
                  <Plus />
                  Create meter
                </Button>
              ) : null}
              <Button
                render={<Link href="/utilities/readings" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to readings
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
