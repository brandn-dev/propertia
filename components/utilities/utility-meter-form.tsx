"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import type { UtilityMeterFormState } from "@/app/(dashboard)/utilities/actions";
import { UTILITY_TYPES, UTILITY_TYPE_LABELS } from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClassName =
  "select-blank";

const initialState: UtilityMeterFormState = {};

type UtilityMeterFormProps = {
  mode: "create" | "edit";
  formAction: (
    state: UtilityMeterFormState,
    formData: FormData
  ) => Promise<UtilityMeterFormState>;
  propertyOptions: {
    id: string;
    name: string;
    propertyCode: string;
    status: string;
  }[];
  tenantOptions: {
    id: string;
    type: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
    propertyIds: string[];
  }[];
  initialValues?: {
    propertyId: string;
    tenantId: string;
    utilityType: (typeof UTILITY_TYPES)[number];
    meterCode: string;
    isShared: boolean;
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function UtilityMeterForm({
  mode,
  formAction,
  propertyOptions,
  tenantOptions,
  initialValues = {
    propertyId: "",
    tenantId: "",
    utilityType: "ELECTRICITY",
    meterCode: "",
    isShared: false,
  },
}: UtilityMeterFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [selectedPropertyId, setSelectedPropertyId] = useState(initialValues.propertyId);
  const [isShared, setIsShared] = useState(initialValues.isShared);
  const [selectedTenantId, setSelectedTenantId] = useState(initialValues.tenantId);

  const eligibleTenants = useMemo(
    () =>
      tenantOptions.filter((tenant) =>
        tenant.propertyIds.includes(selectedPropertyId)
      ),
    [tenantOptions, selectedPropertyId]
  );

  function formatTenantLabel(tenant: UtilityMeterFormProps["tenantOptions"][number]) {
    return (
      tenant.businessName ||
      [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
      "Tenant"
    );
  }

  const canSubmit = isShared || eligibleTenants.length > 0;

  function handlePropertyChange(nextPropertyId: string) {
    setSelectedPropertyId(nextPropertyId);

    const tenantStillEligible = tenantOptions.some(
      (tenant) =>
        tenant.id === selectedTenantId &&
        tenant.propertyIds.includes(nextPropertyId)
    );

    if (!tenantStillEligible) {
      setSelectedTenantId("");
    }
  }

  function handleSharedChange(nextShared: boolean) {
    setIsShared(nextShared);

    if (nextShared) {
      setSelectedTenantId("");
    }
  }

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-xl p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="propertyId">Property</Label>
              <select
                id="propertyId"
                name="propertyId"
                value={selectedPropertyId}
                onChange={(event) => handlePropertyChange(event.target.value)}
                className={selectClassName}
              >
                <option value="">Select a property</option>
                {propertyOptions.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name} ({property.propertyCode})
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.propertyId?.[0]} />
            </div>

            {!isShared ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tenantId">Tenant</Label>
                <select
                  id="tenantId"
                  name="tenantId"
                  value={selectedTenantId}
                  onChange={(event) => setSelectedTenantId(event.target.value)}
                  className={selectClassName}
                  disabled={!selectedPropertyId || eligibleTenants.length === 0}
                >
                  <option value="">
                    {selectedPropertyId
                      ? "Select a tenant"
                      : "Select a property first"}
                  </option>
                  {eligibleTenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {formatTenantLabel(tenant)}
                    </option>
                  ))}
                </select>
                <FieldError message={state.errors?.tenantId?.[0]} />
                {selectedPropertyId && eligibleTenants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No draft or active tenant assignments are available on this
                    property yet. Create a contract first, or mark this meter as
                    shared.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="utilityType">Utility type</Label>
              <select
                id="utilityType"
                name="utilityType"
                defaultValue={initialValues.utilityType}
                className={selectClassName}
              >
                {UTILITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {UTILITY_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.utilityType?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meterCode">Meter code</Label>
              <Input
                id="meterCode"
                name="meterCode"
                defaultValue={initialValues.meterCode}
                placeholder="MERALCO-01"
                className="field-blank h-11 uppercase"
              />
              <FieldError message={state.errors?.meterCode?.[0]} />
            </div>

            <div className="md:col-span-2">
              <label className="field-blank flex items-start gap-3 rounded-[1.2rem] border bg-background/60 px-4 py-3">
                <input
                  type="checkbox"
                  name="isShared"
                  checked={isShared}
                  onChange={(event) => handleSharedChange(event.target.checked)}
                  className="mt-1 size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Shared utility source</span>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Shared meters stay property-level. Dedicated meters are assigned
                    to a tenant on the selected property.
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

        <aside className="space-y-4">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              {mode === "create" ? "New record" : "Update record"}
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {mode === "create" ? "Create meter" : "Save meter changes"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "create"
                ? "Create a utility meter attached to a property and assign it to the correct tenant before the first reading is captured."
                : "Update meter identity or tenant assignment without disturbing the historical readings already captured."}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || !canSubmit}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                {mode === "create" ? "Create meter" : "Save changes"}
              </Button>
              <Button
                render={<Link href="/utilities/meters" />}
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
