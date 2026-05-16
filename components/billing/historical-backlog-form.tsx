"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleDollarSign, LoaderCircle, Save } from "lucide-react";
import type { HistoricalBacklogFormState } from "@/app/(dashboard)/billing/backlog/actions";
import { HistoricalBacklogMonthEditor } from "@/components/billing/historical-backlog-month-editor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/ui/toast-provider";
import {
  buildBacklogMonthRowKey,
  getContractDraftValidationMap,
  getDraftForCycle,
  getTenantOptions,
  serializeMonthDraft,
  updateDraftMapForCycle,
  type HistoricalBacklogDraftMap,
  type HistoricalBacklogContractOption,
} from "@/lib/billing/historical-backlog-drafts";
import { BACKLOG_PAYMENT_STATUS_LABELS } from "@/lib/form-options";

const selectClassName = "select-blank";
const initialState: HistoricalBacklogFormState = {};

type HistoricalBacklogFormProps = {
  formAction: (
    state: HistoricalBacklogFormState,
    formData: FormData
  ) => Promise<HistoricalBacklogFormState>;
  contractOptions: HistoricalBacklogContractOption[];
  cutoffLabel: string;
  initialSelection?: {
    tenantId?: string;
    contractId?: string;
    cycleKey?: string;
  };
};

function resolveInitialSelection(
  contractOptions: HistoricalBacklogContractOption[],
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
  };
}

export function HistoricalBacklogForm({
  formAction,
  contractOptions,
  cutoffLabel,
  initialSelection,
}: HistoricalBacklogFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [drafts, setDrafts] = useState<HistoricalBacklogDraftMap>({});
  const router = useRouter();
  useActionToast({
    message: state.message,
    title: "Backlog month blocked",
    intent: "error",
  });
  useEffect(() => {
    if (!pending) {
      const timer = window.setTimeout(() => {
        setSubmitLocked(false);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [pending, state]);
  useEffect(() => {
    if (!state.refreshRequired) {
      return;
    }

    const timer = window.setTimeout(() => {
      router.refresh();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [router, state.refreshRequired]);

  const tenantOptions = useMemo(
    () => getTenantOptions(contractOptions),
    [contractOptions]
  );
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
  const activeDraft = getDraftForCycle({
    drafts,
    contract: currentContract,
    cycle: currentCycle,
  });
  const validationMap = currentContract
    ? getContractDraftValidationMap(currentContract, drafts)
    : new Map<string, string[]>();
  const activeValidationMessages = activeDraft
    ? validationMap.get(activeDraft.rowKey)
    : undefined;
  const activeRowKey = currentContract && currentCycle
    ? buildBacklogMonthRowKey(currentContract.id, currentCycle.key)
    : "";
  const visibleErrors =
    !state.rowKey || state.rowKey === activeRowKey ? state.errors : undefined;
  const serializedDraft = activeDraft ? serializeMonthDraft(activeDraft) : null;
  const canSubmit = Boolean(currentContract && currentCycle && activeDraft);

  function handleTenantChange(nextTenantId: string) {
    setSelectedTenantId(nextTenantId);
    const nextContracts = contractOptions.filter(
      (contract) => contract.tenantId === nextTenantId
    );
    const nextContract = nextContracts[0] ?? null;
    const nextCycle = nextContract?.pendingBacklogCycles[0] ?? null;
    setSelectedContractId(nextContract?.id ?? "");
    setSelectedCycleKey(nextCycle?.key ?? "");
  }

  function handleContractChange(nextContractId: string) {
    setSelectedContractId(nextContractId);
    const nextContract =
      visibleContracts.find((contract) => contract.id === nextContractId) ?? null;
    setSelectedCycleKey(nextContract?.pendingBacklogCycles[0]?.key ?? "");
  }

  function handleCycleChange(nextCycleKey: string) {
    setSelectedCycleKey(nextCycleKey);
  }

  return (
    <form
      action={action}
      className="space-y-6"
      onSubmitCapture={(event) => {
        if (submitLocked || pending) {
          event.preventDefault();
          return;
        }

        setSubmitLocked(true);
      }}
    >
      <input type="hidden" name="rowKey" value={activeRowKey} readOnly />
      <input
        type="hidden"
        name="contractId"
        value={serializedDraft?.contractId ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="billingPeriodStart"
        value={serializedDraft?.billingPeriodStart ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="billingPeriodEnd"
        value={serializedDraft?.billingPeriodEnd ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="issueDate"
        value={serializedDraft?.issueDate ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="dueDate"
        value={serializedDraft?.dueDate ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="rentAmount"
        value={serializedDraft?.rentAmount ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="utilityReadings"
        value={JSON.stringify(serializedDraft?.utilityReadings ?? [])}
        readOnly
      />
      <input
        type="hidden"
        name="recurringChargeIds"
        value={JSON.stringify(serializedDraft?.recurringChargeIds ?? [])}
        readOnly
      />
      <input
        type="hidden"
        name="utilityCharges"
        value={JSON.stringify(serializedDraft?.utilityCharges ?? [])}
        readOnly
      />
      <input
        type="hidden"
        name="adjustments"
        value={JSON.stringify(serializedDraft?.adjustments ?? [])}
        readOnly
      />
      <input
        type="hidden"
        name="paymentStatus"
        value={serializedDraft?.payment.status ?? "UNPAID"}
        readOnly
      />
      <input
        type="hidden"
        name="paymentAmount"
        value={serializedDraft?.payment.amount ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="paymentDate"
        value={serializedDraft?.payment.paymentDate ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="referenceNumber"
        value={serializedDraft?.payment.referenceNumber ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="paymentNotes"
        value={serializedDraft?.payment.notes ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="notes"
        value={serializedDraft?.notes ?? ""}
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
                {visibleErrors?.contractId?.[0] ? (
                  <p className="text-sm text-destructive">
                    {visibleErrors.contractId[0]}
                  </p>
                ) : null}
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
                        {cycle.label}
                      </option>
                    ))
                  ) : (
                    <option value="">No missing historical months</option>
                  )}
                </select>
                {visibleErrors?.billingPeriodStart?.[0] ? (
                  <p className="text-sm text-destructive">
                    {visibleErrors.billingPeriodStart[0]}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Historical backlog includes transition month starting {cutoffLabel}.
                  Later months move to strict generator.
                </p>
              </div>
            </div>
          </div>

          <HistoricalBacklogMonthEditor
            contract={currentContract}
            cycle={currentCycle}
            draft={activeDraft}
            fieldErrors={visibleErrors}
            validationMessages={activeValidationMessages}
            onChange={(updater) => {
              if (!currentContract || !currentCycle) {
                return;
              }

              setDrafts((current) =>
                updateDraftMapForCycle(
                  current,
                  currentContract,
                  currentCycle,
                  updater
                )
              );
            }}
          />
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
              Real backlog invoice, optional payment, real meter readings when safe.
              Later months after {cutoffLabel} stay in strict generator.
            </p>

            <div className="mt-5 space-y-3 rounded-[1.2rem] border border-border/60 bg-background/60 px-4 py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Property</span>
                <span className="font-medium">
                  {activeDraft?.contractLabel ?? "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Month</span>
                <span className="font-medium">
                  {activeDraft?.billingMonthLabel ?? "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Recurring charges</span>
                <span className="font-medium">
                  {activeDraft?.recurringCharges.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Readings</span>
                <span className="font-medium">
                  {activeDraft?.utilityReadings.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Manual utility lines</span>
                <span className="font-medium">
                  {activeDraft?.utilityCharges.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Other adjustments</span>
                <span className="font-medium">
                  {activeDraft?.adjustments.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Payment snapshot</span>
                <span className="font-medium">
                  {activeDraft
                    ? BACKLOG_PAYMENT_STATUS_LABELS[activeDraft.payment.status]
                    : "Not set"}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || submitLocked || !canSubmit}
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
