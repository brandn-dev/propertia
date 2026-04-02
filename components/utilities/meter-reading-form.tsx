"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Plus, Save } from "lucide-react";
import type { MeterReadingFormState } from "@/app/(dashboard)/utilities/actions";
import { formatDate } from "@/lib/format";
import type { AppRole } from "@/lib/auth/roles";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "field-blank flex h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50";

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
    readingDate: string;
    currentReading: string;
  }[];
};

type MeterReadingFormProps = {
  formAction: (
    state: MeterReadingFormState,
    formData: FormData
  ) => Promise<MeterReadingFormState>;
  meterOptions: MeterOption[];
  role: AppRole;
  initialValues?: {
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
  formAction,
  meterOptions,
  role,
  initialValues = {
    meterId: "",
    readingDate: new Date().toISOString().slice(0, 10),
    currentReading: "",
    ratePerUnit: "",
  },
}: MeterReadingFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);

  const initialMeter =
    meterOptions.find((meter) => meter.id === initialValues.meterId) ?? null;
  const [selectedScopeKey, setSelectedScopeKey] = useState(
    initialMeter ? getScopeKey(initialMeter) : ""
  );
  const [selectedMeterId, setSelectedMeterId] = useState(initialValues.meterId);

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

  const lastReading = selectedMeter?.readings[0] ?? null;
  const hasScopeOptions =
    tenantScopeOptions.length > 0 || sharedScopeOptions.length > 0;
  const hasTenantOptions = tenantScopeOptions.length > 0;

  function handleScopeChange(nextScopeKey: string) {
    setSelectedScopeKey(nextScopeKey);

    const nextMeters = meterOptions.filter(
      (meter) => getScopeKey(meter) === nextScopeKey
    );

    if (!nextMeters.some((meter) => meter.id === selectedMeterId)) {
      setSelectedMeterId("");
    }
  }

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-[1.85rem] p-6">
          <div className="grid gap-5 md:grid-cols-2">
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

            <div className="space-y-2">
              <Label htmlFor="readingDate">Reading date</Label>
              <Input
                id="readingDate"
                name="readingDate"
                type="date"
                defaultValue={initialValues.readingDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.readingDate?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentReading">Current reading</Label>
              <Input
                id="currentReading"
                name="currentReading"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.currentReading}
                placeholder="1250.50"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.currentReading?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ratePerUnit">Rate per unit</Label>
              <Input
                id="ratePerUnit"
                name="ratePerUnit"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.ratePerUnit}
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
                    {lastReading
                      ? `Last reading: ${lastReading.currentReading} on ${formatDate(lastReading.readingDate)}. New readings must be later than this date and at least this value.`
                      : "No previous reading found. This will be treated as the initial reading for the selected meter."}
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  Select a tenant first, then choose one of the meters assigned to
                  that tenant before recording the next capture. Shared property
                  meters stay available under their own scope when needed.
                </p>
              )}
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
              New reading
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Capture utility reading
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Choose the tenant first, then record the next chronological reading
              for one of that tenant&apos;s assigned meters. The system calculates
              previous reading, consumption, and total charge automatically.
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
                Record reading
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
                Back to utilities
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
