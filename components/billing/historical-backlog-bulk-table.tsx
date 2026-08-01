"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  Eye,
  FilePenLine,
  LoaderCircle,
  RotateCcw,
  Save,
} from "lucide-react";
import type { HistoricalBacklogBulkFormState } from "@/app/(dashboard)/billing/backlog/actions";
import { HistoricalBacklogMonthEditor } from "@/components/billing/historical-backlog-month-editor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActionToast } from "@/components/ui/toast-provider";
import { BACKLOG_PAYMENT_STATUS_LABELS } from "@/lib/form-options";
import {
  buildPropertyGroups,
  getContractDraftValidationMap,
  getDraftForCycle,
  getTenantOptions,
  serializeMonthDraft,
  updateDraftMapForCycle,
  type HistoricalBacklogDraftMap,
  type HistoricalBacklogContractOption,
} from "@/lib/billing/historical-backlog-drafts";

const selectClassName = "select-blank";
const initialState: HistoricalBacklogBulkFormState = {};

type HistoricalBacklogBulkTableProps = {
  formAction: (
    state: HistoricalBacklogBulkFormState,
    formData: FormData
  ) => Promise<HistoricalBacklogBulkFormState>;
  contractOptions: HistoricalBacklogContractOption[];
  cutoffLabel: string;
};

function buildSelectedKeySet(keys: string[]) {
  return new Set(keys);
}

export function HistoricalBacklogBulkTable({
  formAction,
  contractOptions,
  cutoffLabel,
}: HistoricalBacklogBulkTableProps) {
  const [state, setState] = useState<HistoricalBacklogBulkFormState>(initialState);
  const [pending, startTransition] = useTransition();
  const [submitLocked, setSubmitLocked] = useState(false);
  const [drafts, setDrafts] = useState<HistoricalBacklogDraftMap>({});
  const router = useRouter();
  const tenantOptions = useMemo(
    () => getTenantOptions(contractOptions),
    [contractOptions]
  );
  const [selectedTenantId, setSelectedTenantId] = useState(
    tenantOptions[0]?.id ?? ""
  );
  const [contractFilter, setContractFilter] = useState("ALL");
  const visibleContracts = contractOptions.filter(
    (contract) => contract.tenantId === selectedTenantId
  );
  const propertyGroups = useMemo(
    () => buildPropertyGroups(contractOptions, selectedTenantId, contractFilter),
    [contractFilter, contractOptions, selectedTenantId]
  );
  const visibleMonthKeys = useMemo(
    () => propertyGroups.flatMap((group) => group.months.map((month) => month.rowKey)),
    [propertyGroups]
  );
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<string[]>(visibleMonthKeys);
  const [activeSheet, setActiveSheet] = useState<{
    contractId: string;
    cycleKey: string;
  } | null>(null);
  const failedRowCount = Object.keys(state.rowErrors ?? {}).filter(
    (key) => key !== "_form"
  ).length;
  const savedRowMap = useMemo(
    () => new Map((state.savedRows ?? []).map((row) => [row.rowKey, row.invoiceId])),
    [state.savedRows]
  );

  useActionToast({
    message: state.message,
    title:
      state.savedRowKeys?.length && failedRowCount === 0
        ? "Backlog rows saved"
        : state.savedRowKeys?.length
          ? "Backlog rows partially saved"
          : "Backlog bulk save blocked",
    intent:
      state.savedRowKeys?.length && failedRowCount === 0
        ? "success"
        : state.savedRowKeys?.length
          ? "info"
          : state.message
            ? "error"
            : undefined,
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
  const selectedMonthKeySet = useMemo(
    () => buildSelectedKeySet(selectedMonthKeys),
    [selectedMonthKeys]
  );
  const selectedVisibleMonths = useMemo(
    () => visibleMonthKeys.filter((rowKey) => selectedMonthKeySet.has(rowKey)),
    [selectedMonthKeySet, visibleMonthKeys]
  );
  const submittableSelectedMonths = useMemo(
    () => selectedVisibleMonths.filter((rowKey) => !savedRowMap.has(rowKey)),
    [savedRowMap, selectedVisibleMonths]
  );
  const activeContract = activeSheet
    ? contractOptions.find((contract) => contract.id === activeSheet.contractId) ?? null
    : null;
  const activeCycle =
    activeContract?.pendingBacklogCycles.find(
      (cycle) => cycle.key === activeSheet?.cycleKey
    ) ?? null;
  const activeDraft = getDraftForCycle({
    drafts,
    contract: activeContract,
    cycle: activeCycle,
  });
  const activeValidationMessages = useMemo(() => {
    if (!activeContract || !activeDraft) {
      return undefined;
    }

    return getContractDraftValidationMap(activeContract, drafts).get(activeDraft.rowKey);
  }, [activeContract, activeDraft, drafts]);
  const serializedRows = JSON.stringify(
    propertyGroups
      .flatMap((group) =>
        group.months
          .filter(
            (month) =>
              selectedMonthKeySet.has(month.rowKey) && !savedRowMap.has(month.rowKey)
          )
          .map((month) => {
            const contract =
              contractOptions.find((entry) => entry.id === group.contractId) ?? null;
            const cycle =
              contract?.pendingBacklogCycles.find(
                (entry) => entry.key === month.cycleKey
              ) ?? null;
            const draft = getDraftForCycle({
              drafts,
              contract,
              cycle,
            });

            return draft && cycle
              ? {
                  ...serializeMonthDraft(draft),
                  billingPeriodStart: cycle.start,
                  billingPeriodEnd: cycle.end,
                }
              : null;
          })
      )
      .filter(Boolean)
  );

  function resetVisibleScope() {
    setSelectedMonthKeys(visibleMonthKeys);
    setState(initialState);
  }

  function handleTenantChange(nextTenantId: string) {
    setSelectedTenantId(nextTenantId);
    const nextVisibleMonthKeys = buildPropertyGroups(
      contractOptions,
      nextTenantId,
      "ALL"
    ).flatMap((group) => group.months.map((month) => month.rowKey));
    setContractFilter("ALL");
    setSelectedMonthKeys(nextVisibleMonthKeys);
    setState(initialState);
  }

  function handleContractFilterChange(nextContractFilter: string) {
    setContractFilter(nextContractFilter);
    const nextVisibleMonthKeys = buildPropertyGroups(
      contractOptions,
      selectedTenantId,
      nextContractFilter
    ).flatMap((group) => group.months.map((month) => month.rowKey));
    setSelectedMonthKeys(nextVisibleMonthKeys);
    setState(initialState);
  }

  function updateGroupSelection(groupRowKeys: string[], selected: boolean) {
    setSelectedMonthKeys((current) => {
      const next = new Set(current);

      for (const rowKey of groupRowKeys) {
        if (selected) {
          next.add(rowKey);
        } else {
          next.delete(rowKey);
        }
      }

      return [...next];
    });
  }

  function toggleMonthSelection(rowKey: string, selected: boolean) {
    setSelectedMonthKeys((current) => {
      const next = new Set(current);

      if (selected) {
        next.add(rowKey);
      } else {
        next.delete(rowKey);
      }

      return [...next];
    });
  }

  function submitRows(formData: FormData) {
    startTransition(async () => {
      const nextState = await formAction(state, formData);
      setState(nextState);
    });
  }

  return (
    <form
      action={submitRows}
      className="space-y-6"
      onSubmitCapture={(event) => {
        if (submitLocked || pending) {
          event.preventDefault();
          return;
        }

        setSubmitLocked(true);
      }}
    >
      <input type="hidden" name="rows" value={serializedRows} readOnly />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="border-blank rounded-xl p-6">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tenantFilter">Business</Label>
                <select
                  id="tenantFilter"
                  value={selectedTenantId}
                  onChange={(event) => handleTenantChange(event.target.value)}
                  className={selectClassName}
                  disabled={tenantOptions.length === 0}
                >
                  {tenantOptions.length === 0 ? (
                    <option value="">No business backlog</option>
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
                <Label htmlFor="contractFilter">Contract scope</Label>
                <select
                  id="contractFilter"
                  value={contractFilter}
                  onChange={(event) =>
                    handleContractFilterChange(event.target.value)
                  }
                  className={selectClassName}
                  disabled={visibleContracts.length === 0}
                >
                  <option value="ALL">All contracts</option>
                  {visibleContracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.property.propertyCode} · {contract.property.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Missing historical months</Label>
                <div className="field-blank flex h-11 items-center rounded-xl border px-4 text-sm text-muted-foreground">
                  {selectedVisibleMonths.length} selected of {visibleMonthKeys.length} month(s)
                  through transition month {cutoffLabel}
                </div>
              </div>
            </div>

            {state.rowErrors?._form?.[0] ? (
              <p className="mt-4 text-sm text-destructive">
                {state.rowErrors._form[0]}
              </p>
            ) : null}
            {state.message ? (
              <p className="mt-4 text-sm text-muted-foreground">{state.message}</p>
            ) : null}
          </div>

          <div className="border-blank rounded-xl p-6">
            {propertyGroups.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                No missing historical months in this filter. Change business or
                contract scope.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">All</TableHead>
                      <TableHead className="min-w-56">Property</TableHead>
                      <TableHead className="min-w-96">Backlog months</TableHead>
                      <TableHead className="min-w-48">Recurring summary</TableHead>
                      <TableHead className="min-w-36 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propertyGroups.map((group) => {
                      const groupRowKeys = group.months.map((month) => month.rowKey);
                      const selectedCount = groupRowKeys.filter((rowKey) =>
                        selectedMonthKeySet.has(rowKey)
                      ).length;
                      const allSelected =
                        groupRowKeys.length > 0 && selectedCount === groupRowKeys.length;
                      const firstOpenMonth =
                        group.months.find((month) => !savedRowMap.has(month.rowKey)) ??
                        group.months[0];

                      return (
                        <TableRow key={group.groupKey} className="align-top">
                          <TableCell>
                            <label className="flex min-h-10 items-center justify-center">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(event) =>
                                  updateGroupSelection(
                                    groupRowKeys,
                                    event.target.checked
                                  )
                                }
                                className="size-4 rounded border-border text-primary"
                                aria-label={`Select all backlog months for ${group.contractLabel}`}
                              />
                            </label>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{group.contractLabel}</p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {selectedCount} of {group.monthCount} month(s) selected
                            </p>
                            {!group.hasMeters ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                No dedicated meters. Manual utility charges path only.
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {group.months.map((month) => {
                                const rowErrors = state.rowErrors?.[month.rowKey] ?? [];
                                const isSaved = savedRowMap.has(month.rowKey);

                                return (
                                  <div
                                    key={month.rowKey}
                                    className="rounded-[1.15rem] border border-border/60 bg-background/60 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedMonthKeySet.has(month.rowKey)}
                                        onChange={(event) =>
                                          toggleMonthSelection(
                                            month.rowKey,
                                            event.target.checked
                                          )
                                        }
                                        className="size-4 rounded border-border text-primary"
                                        aria-label={`Select ${month.label}`}
                                      />
                                      <button
                                        type="button"
                                        className="text-sm font-medium transition hover:text-primary"
                                        onClick={() =>
                                          setActiveSheet({
                                            contractId: group.contractId,
                                            cycleKey: month.cycleKey,
                                          })
                                        }
                                      >
                                        {month.label}
                                      </button>
                                      {isSaved ? (
                                        <Check className="size-4 text-success" />
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {month.billingPeriodStart} to {month.billingPeriodEnd}
                                    </p>
                                    {rowErrors.length > 0 ? (
                                      <p className="mt-1 text-xs text-destructive">
                                        {rowErrors[0]}
                                      </p>
                                    ) : isSaved ? (
                                      <p className="mt-1 text-xs text-success">
                                        Saved
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {group.recurringSummary.length > 0 ? (
                              <div className="space-y-1 text-sm text-muted-foreground">
                                {group.recurringSummary.map((label) => (
                                  <p key={`${group.groupKey}-${label}`}>{label}</p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No active recurring charges
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {firstOpenMonth ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="button-blank h-10 rounded-xl"
                                onClick={() =>
                                  setActiveSheet({
                                    contractId: group.contractId,
                                    cycleKey: firstOpenMonth.cycleKey,
                                  })
                                }
                              >
                                Open details
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              Bulk backlog
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Grouped entry
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Choose business, open month in sheet, edit only months that need detail.
              Untouched selected months still save with defaults.
            </p>

            <div className="mt-5 space-y-3 rounded-[1.2rem] border border-border/60 bg-background/60 px-4 py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Visible groups</span>
                <span className="font-medium">{propertyGroups.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Visible months</span>
                <span className="font-medium">{visibleMonthKeys.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Selected months</span>
                <span className="font-medium">{selectedVisibleMonths.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Ready to save</span>
                <span className="font-medium">{submittableSelectedMonths.length}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || submitLocked || submittableSelectedMonths.length === 0}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                Save selected months
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
                onClick={resetVisibleScope}
              >
                <RotateCcw />
                Reset visible selection
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <Sheet
        open={Boolean(activeSheet)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSheet(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full p-0 data-[side=right]:sm:max-w-4xl">
          <SheetHeader className="border-b border-border/60 px-6 py-5">
            <SheetTitle>{activeDraft?.contractLabel ?? "Backlog detail"}</SheetTitle>
            <SheetDescription>
              Switch missing months inside sheet. No redirect. Bulk save stays on this
              page.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {activeContract ? (
              <div className="mb-6 flex flex-wrap gap-2">
                {activeContract.pendingBacklogCycles.map((cycle) => {
                  const rowKey = `${activeContract.id}::${cycle.key}`;
                  const rowErrors = state.rowErrors?.[rowKey] ?? [];
                  const selected = selectedMonthKeySet.has(rowKey);
                  const saved = savedRowMap.has(rowKey);

                  return (
                    <div
                      key={rowKey}
                      className={`rounded-full border px-3 py-2 text-sm ${
                        activeSheet?.cycleKey === cycle.key
                          ? "border-primary bg-primary/8"
                          : "border-border/60 bg-background/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) =>
                            toggleMonthSelection(rowKey, event.target.checked)
                          }
                          className="size-4 rounded border-border text-primary"
                          aria-label={`Select ${cycle.label}`}
                        />
                        <button
                          type="button"
                          className="font-medium"
                          onClick={() =>
                            setActiveSheet({
                              contractId: activeContract.id,
                              cycleKey: cycle.key,
                            })
                          }
                        >
                          {cycle.label}
                        </button>
                        {saved ? <Check className="size-4 text-success" /> : null}
                      </div>
                      {rowErrors.length > 0 ? (
                        <p className="mt-1 text-xs text-destructive">{rowErrors[0]}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <HistoricalBacklogMonthEditor
              contract={activeContract}
              cycle={activeCycle}
              draft={activeDraft}
              summaryErrors={activeDraft ? state.rowErrors?.[activeDraft.rowKey] : undefined}
              validationMessages={activeValidationMessages}
              onChange={(updater) => {
                if (!activeContract || !activeCycle) {
                  return;
                }

                setDrafts((current) =>
                  updateDraftMapForCycle(current, activeContract, activeCycle, updater)
                );
              }}
            />
          </div>

          <SheetFooter className="border-t border-border/60 px-6 py-4">
            <div className="flex w-full items-center justify-between gap-4 text-sm">
              <div className="text-muted-foreground">
                {activeDraft ? BACKLOG_PAYMENT_STATUS_LABELS[activeDraft.payment.status] : ""}
              </div>
              <div className="flex items-center gap-2">
                {activeDraft && savedRowMap.has(activeDraft.rowKey) ? (
                  <>
                    <Button
                      render={<Link href={`/billing/${savedRowMap.get(activeDraft.rowKey)}`} />}
                      variant="outline"
                      className="button-blank rounded-xl"
                    >
                      <Eye />
                      Open invoice
                    </Button>
                    <Button
                      render={
                        <Link
                          href={`/billing/${savedRowMap.get(activeDraft.rowKey)}/edit`}
                        />
                      }
                      variant="outline"
                      className="button-blank rounded-xl"
                    >
                      <FilePenLine />
                      Edit invoice
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="button-blank rounded-xl"
                  onClick={() => setActiveSheet(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </form>
  );
}
