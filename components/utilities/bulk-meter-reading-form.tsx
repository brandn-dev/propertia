"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import type { BulkMeterReadingFormState } from "@/app/(dashboard)/utilities/actions";
import type { AppRole } from "@/lib/auth/roles";
import { calculateCosaAllocations } from "@/lib/billing/cosa";
import {
  ALLOCATION_TYPE_LABELS,
  type ALLOCATION_TYPES,
  UTILITY_TYPE_LABELS,
} from "@/lib/form-options";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MeterOption = {
  id: string;
  meterCode: string;
  utilityType: keyof typeof UTILITY_TYPE_LABELS;
  isShared: boolean;
  openingReading: string;
  tenant: { id: string; firstName: string | null; lastName: string | null; businessName: string | null } | null;
  property: { id: string; name: string; propertyCode: string };
  readings: { readingDate: string; currentReading: string; ratePerUnit: string }[];
};

type CosaTemplateOption = {
  id: string;
  name: string;
  allocationType: (typeof ALLOCATION_TYPES)[number];
  calculationMode: string;
  isActive: boolean;
  property: { id: string; name: string; propertyCode: string };
  meter: { id: string; meterCode: string; utilityType: string } | null;
  allocations: Array<{
    helperLabel: string | null;
    percentage: string | null;
    unitCount: number | null;
    amount: string | null;
    contract: {
      id: string;
      property: { name: string; propertyCode: string; size: string | null };
      tenant: {
        firstName: string | null;
        lastName: string | null;
        businessName: string | null;
      };
    } | null;
  }>;
};

type Draft = {
  enabled: boolean;
  readingDate: string;
  currentReading: string;
  ratePerUnit: string;
  startingReadingOverride: string;
  cosaTemplateId: string;
};

function tenantLabel(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return tenant.businessName || [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") || "Tenant";
}

export function BulkMeterReadingForm({ formAction, meterOptions, cosaTemplates, role, initialMode = "tenant", initialPropertyId = "", initialTemplateId = "" }: {
  formAction: (state: BulkMeterReadingFormState, formData: FormData) => Promise<BulkMeterReadingFormState>;
  meterOptions: MeterOption[];
  cosaTemplates: CosaTemplateOption[];
  role: AppRole;
  initialMode?: "tenant" | "shared";
  initialPropertyId?: string;
  initialTemplateId?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const initialScope = initialMode === "shared" && initialPropertyId ? `property:${initialPropertyId}` : "";
  const [state, action, pending] = useActionState(formAction, {});
  const [mode, setMode] = useState<"tenant" | "shared">(initialMode);
  const [scopeKey, setScopeKey] = useState(initialScope);
  function makeDraft(meter: MeterOption): Draft {
    const initialTemplate = cosaTemplates.find(
      (template) =>
        template.id === initialTemplateId &&
        template.meter?.id === meter.id &&
        template.calculationMode === "METER_READING"
    );

    return {
      enabled: true,
      readingDate: today,
      currentReading: "",
      ratePerUnit: meter.readings[0]?.ratePerUnit ?? "",
      startingReadingOverride: "",
      cosaTemplateId: initialTemplate?.id ?? "",
    };
  }

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      meterOptions
        .filter(
          (meter) =>
            initialScope === `property:${meter.property.id}` &&
            meter.isShared &&
            ["WATER", "ELECTRICITY"].includes(meter.utilityType)
        )
        .map((meter) => [meter.id, makeDraft(meter)])
    )
  );
  const tenantScopes = useMemo(() => Array.from(new Map(meterOptions.filter((meter) => meter.tenant && !meter.isShared).map((meter) => [meter.tenant!.id, meter.tenant!])).values()), [meterOptions]);
  const propertyScopes = useMemo(() => Array.from(new Map(meterOptions.filter((meter) => meter.isShared).map((meter) => [meter.property.id, meter.property])).values()), [meterOptions]);
  const visibleMeters = meterOptions.filter((meter) => {
    if (!["WATER", "ELECTRICITY"].includes(meter.utilityType)) return false;
    return mode === "tenant"
      ? meter.tenant && !meter.isShared && scopeKey === `tenant:${meter.tenant.id}`
      : meter.isShared && scopeKey === `property:${meter.property.id}`;
  });

  function chooseScope(next: string) {
    setScopeKey(next);
    const nextMeters = meterOptions.filter((meter) => ["WATER", "ELECTRICITY"].includes(meter.utilityType) && (mode === "tenant" ? meter.tenant && !meter.isShared && next === `tenant:${meter.tenant.id}` : meter.isShared && next === `property:${meter.property.id}`));
    setDrafts(
      Object.fromEntries(nextMeters.map((meter) => [meter.id, makeDraft(meter)]))
    );
  }
  function changeMode(next: "tenant" | "shared") { setMode(next); setScopeKey(""); setDrafts({}); }
  function update(meterId: string, changes: Partial<Draft>) { setDrafts((current) => ({ ...current, [meterId]: { ...current[meterId], ...changes } })); }
  const rows = visibleMeters.filter((meter) => drafts[meter.id]?.enabled).map((meter) => ({ meterId: meter.id, readingDate: drafts[meter.id].readingDate, currentReading: drafts[meter.id].currentReading, ratePerUnit: drafts[meter.id].ratePerUnit, startingReadingOverride: drafts[meter.id].startingReadingOverride, cosaTemplateId: mode === "shared" ? drafts[meter.id].cosaTemplateId : "" }));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="readings" value={JSON.stringify(rows)} readOnly />
      <div className="border-blank space-y-5 rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Reading mode</Label><select value={mode} onChange={(event) => changeMode(event.target.value as "tenant" | "shared")} className="select-blank"><option value="tenant">Tenant utilities</option><option value="shared">Shared / COSA utilities</option></select></div>
          <div className="space-y-2"><Label>{mode === "tenant" ? "Tenant" : "Property"}</Label><select value={scopeKey} onChange={(event) => chooseScope(event.target.value)} className="select-blank"><option value="">Select {mode === "tenant" ? "tenant" : "property"}</option>{mode === "tenant" ? tenantScopes.map((tenant) => <option key={tenant.id} value={`tenant:${tenant.id}`}>{tenantLabel(tenant)}</option>) : propertyScopes.map((property) => <option key={property.id} value={`property:${property.id}`}>{property.propertyCode} · {property.name}</option>)}</select></div>
        </div>
        <p className="text-sm text-muted-foreground">Water and electricity meters load together. Uncheck any meter not being captured today.</p>
        <div className="space-y-4">
          {visibleMeters.map((meter, index) => {
            const draft = drafts[meter.id];
            if (!draft) return null;
            const previous = Number(meter.readings[0]?.currentReading ?? meter.openingReading);
            const current = Number(draft.currentReading || previous);
            const amount = Math.max(0, current - previous) * Number(draft.ratePerUnit || 0);
            const matchingTemplates = cosaTemplates.filter(
              (template) =>
                template.isActive &&
                template.calculationMode === "METER_READING" &&
                template.property.id === meter.property.id &&
                template.meter?.id === meter.id
            );
            const selectedTemplate = matchingTemplates.find(
              (template) => template.id === draft.cosaTemplateId
            );
            let allocationPreview: ReturnType<typeof calculateCosaAllocations> = [];

            if (selectedTemplate && amount >= 0) {
              try {
                allocationPreview = calculateCosaAllocations({
                  allocationType: selectedTemplate.allocationType,
                  totalAmount: amount,
                  entries: selectedTemplate.allocations.map((allocation) => ({
                    contractId: allocation.contract?.id ?? allocation.helperLabel ?? "helper",
                    basisValue: Number(allocation.contract?.property.size ?? 0),
                    percentage: Number(allocation.percentage ?? 0),
                    unitCount: allocation.unitCount,
                    amount: Number(allocation.amount ?? 0),
                  })),
                });
              } catch {
                allocationPreview = [];
              }
            }
            const enabledIndex = visibleMeters
              .slice(0, index + 1)
              .filter((candidate) => drafts[candidate.id]?.enabled).length - 1;
            const errors = draft.enabled ? state.rowErrors?.[enabledIndex] : undefined;
            return <div key={meter.id} className="rounded-xl border border-border/60 bg-background/55 p-4">
              <label className="flex items-center gap-3"><input type="checkbox" checked={draft.enabled} onChange={(event) => update(meter.id, { enabled: event.target.checked })} /><span className="font-medium">{UTILITY_TYPE_LABELS[meter.utilityType]} · {meter.meterCode}</span><span className="text-sm text-muted-foreground">Previous {previous.toFixed(2)}</span></label>
              {draft.enabled ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={draft.readingDate} onChange={(event) => update(meter.id, { readingDate: event.target.value })} className="field-blank h-11" /><p className="text-xs text-destructive">{errors?.readingDate?.[0]}</p></div>
                <div className="space-y-2"><Label>Current reading</Label><Input type="number" min="0" step="0.01" value={draft.currentReading} onChange={(event) => update(meter.id, { currentReading: event.target.value })} className="field-blank h-11" /><p className="text-xs text-destructive">{errors?.currentReading?.[0]}</p></div>
                <div className="space-y-2"><Label>Rate per unit</Label><Input type="number" min="0" step="0.01" value={draft.ratePerUnit} onChange={(event) => update(meter.id, { ratePerUnit: event.target.value })} className="field-blank h-11" /><p className="text-xs text-destructive">{errors?.ratePerUnit?.[0]}</p></div>
                <div className="space-y-2"><Label>Computed amount</Label><div className="field-blank flex h-11 items-center rounded-xl border px-3">{formatCurrency(amount)}</div></div>
                {role === "ADMIN" && meter.readings.length === 0 ? <div className="space-y-2"><Label>Starting baseline override</Label><Input type="number" min="0" step="0.01" value={draft.startingReadingOverride} onChange={(event) => update(meter.id, { startingReadingOverride: event.target.value })} className="field-blank h-11" /><p className="text-xs text-destructive">{errors?.startingReadingOverride?.[0]}</p></div> : null}
              </div> : null}
              {draft.enabled && mode === "shared" ? (
                <div className="mt-4 rounded-xl border border-border/60 p-4">
                  <div className="space-y-2">
                    <Label>Matching COSA template (optional)</Label>
                    <select
                      value={draft.cosaTemplateId}
                      onChange={(event) =>
                        update(meter.id, { cosaTemplateId: event.target.value })
                      }
                      className="select-blank"
                    >
                      <option value="">Save reading only</option>
                      {matchingTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} · {ALLOCATION_TYPE_LABELS[template.allocationType]}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-destructive">
                      {errors?.cosaTemplateId?.[0]}
                    </p>
                    {matchingTemplates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No active template is linked to this exact meter. Reading will save without COSA.
                      </p>
                    ) : null}
                  </div>
                  {selectedTemplate ? (
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        Review allocation · {formatCurrency(amount)} total
                      </p>
                      {selectedTemplate.allocations.map((allocation, allocationIndex) => {
                        const participant = allocation.contract
                          ? tenantLabel(allocation.contract.tenant)
                          : allocation.helperLabel ?? "Helper participant";
                        return (
                          <p key={`${selectedTemplate.id}-${allocationIndex}`}>
                            {participant}: {formatCurrency(allocationPreview[allocationIndex]?.computedAmount ?? 0)}
                          </p>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>;
          })}
          {scopeKey && visibleMeters.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No active water or electricity meters found for this scope.</p> : null}
        </div>
        {state.errors?.readings?.[0] || state.message ? <p className="text-sm text-destructive">{state.errors?.readings?.[0] ?? state.message}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2"><Button render={<Link href="/utilities/readings" />} type="button" variant="outline" className="button-blank rounded-xl"><ArrowLeft /> Back</Button><Button type="submit" disabled={pending || rows.length === 0} className="rounded-xl">{pending ? <LoaderCircle className="animate-spin" /> : <Save />} Save {rows.length || ""} reading{rows.length === 1 ? "" : "s"}</Button></div>
    </form>
  );
}
