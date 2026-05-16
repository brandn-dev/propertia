"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import type { UtilityMeterFormState } from "@/app/(dashboard)/utilities/actions";
import { formatDate, toDateInputValue } from "@/lib/format";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionRedirect } from "@/components/ui/use-action-redirect";

const initialState: UtilityMeterFormState = {};

type UtilityMeterReplacementFormProps = {
  formAction: (
    state: UtilityMeterFormState,
    formData: FormData
  ) => Promise<UtilityMeterFormState>;
  meter: {
    id: string;
    meterCode: string;
    utilityType: keyof typeof UTILITY_TYPE_LABELS;
    isShared: boolean;
    openedAt: string;
    retiredAt: string | null;
    openingReading: string;
    property: {
      name: string;
      propertyCode: string;
    };
    tenant: {
      firstName: string | null;
      lastName: string | null;
      businessName: string | null;
    } | null;
    readings: {
      readingDate: string;
      currentReading: string;
    }[];
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function formatTenantName(tenant: NonNullable<UtilityMeterReplacementFormProps["meter"]["tenant"]>) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

export function UtilityMeterReplacementForm({
  formAction,
  meter,
}: UtilityMeterReplacementFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  useActionRedirect(state.redirectTo);
  const latestReading = meter.readings[0] ?? null;
  const defaultOpenedAt = latestReading
    ? toDateInputValue(latestReading.readingDate)
    : toDateInputValue(new Date());

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-xl p-6">
          <div className="rounded-[1.2rem] border border-border/60 bg-background/60 p-4">
            <p className="text-sm font-medium">
              {meter.meterCode} · {UTILITY_TYPE_LABELS[meter.utilityType]}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {meter.tenant
                ? `${formatTenantName(meter.tenant)} · ${meter.property.name} (${meter.property.propertyCode})`
                : `${meter.property.name} (${meter.property.propertyCode}) · Shared property meter`}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {latestReading
                ? `Latest reading: ${latestReading.currentReading} on ${formatDate(latestReading.readingDate)}.`
                : `No readings yet. Opening baseline on current meter is ${meter.openingReading}.`}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="openedAt">Replacement date</Label>
              <Input
                id="openedAt"
                name="openedAt"
                type="date"
                defaultValue={defaultOpenedAt}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.openedAt?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="openingReading">New meter opening reading</Label>
              <Input
                id="openingReading"
                name="openingReading"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.openingReading?.[0]} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="meterCode">New meter code</Label>
              <Input
                id="meterCode"
                name="meterCode"
                placeholder={`${meter.meterCode}-R1`}
                className="field-blank h-11 uppercase"
              />
              <FieldError message={state.errors?.meterCode?.[0]} />
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
              Replacement flow
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Register replacement meter
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This retires the current meter on the selected date and creates a new
              physical meter record with its own chronology starting from the opening
              reading you provide.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                Save replacement
              </Button>
              <Button
                render={<Link href={`/utilities/meters/${meter.id}/edit`} />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to meter
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
