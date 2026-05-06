"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Eye,
  FilePenLine,
  LoaderCircle,
  RotateCcw,
  Save,
} from "lucide-react";
import type { HistoricalBacklogBulkFormState } from "@/app/(dashboard)/billing/backlog/actions";
import { addMonthsClamped, getBillingCycleIndex } from "@/lib/billing/cycles";
import {
  BACKLOG_PAYMENT_STATUS_LABELS,
  BACKLOG_PAYMENT_STATUSES,
} from "@/lib/form-options";
import { toDateInputValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActionToast } from "@/components/ui/toast-provider";

const selectClassName = "select-blank";
const initialState: HistoricalBacklogBulkFormState = {};

type ContractOption = {
  id: string;
  tenantId: string;
  status: string;
  paymentStartDate: string;
  endDate: string;
  monthlyRent: string;
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
  advanceRent: string;
  property: {
    id: string;
    name: string;
    propertyCode: string;
  };
  tenant: {
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  pendingBacklogCycles: {
    key: string;
    start: string;
    end: string;
    label: string;
  }[];
};

type BulkRow = {
  selected: boolean;
  rowKey: string;
  tenantId: string;
  contractId: string;
  contractLabel: string;
  billingMonthLabel: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  autoFreeRent: boolean;
  autoAdvanceRentCredit: string;
  issueDate: string;
  dueDate: string;
  rentAmount: string;
  manualUtilityAmount: string;
  utilityNote: string;
  adjustmentAmount: string;
  arrearsAmount: string;
  paymentStatus: (typeof BACKLOG_PAYMENT_STATUSES)[number];
  paymentAmount: string;
  paymentDate: string;
  referenceNumber: string;
  notes: string;
  readingMissing: boolean;
};

type HistoricalBacklogBulkTableProps = {
  formAction: (
    state: HistoricalBacklogBulkFormState,
    formData: FormData
  ) => Promise<HistoricalBacklogBulkFormState>;
  contractOptions: ContractOption[];
  cutoffLabel: string;
  onNeedsDetail: (selection: {
    tenantId: string;
    contractId: string;
    cycleKey: string;
  }) => void;
};

function formatTenantName(tenant: ContractOption["tenant"]) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function getUtilityServiceWindow(cycleStartValue: string) {
  const cycleStart = new Date(cycleStartValue);
  const serviceStart = addMonthsClamped(cycleStart, -1);
  const serviceEnd = new Date(cycleStart);
  serviceEnd.setDate(serviceEnd.getDate() - 1);
  serviceEnd.setHours(23, 59, 59, 999);

  return {
    label: formatMonthLabel(serviceStart),
    rangeLabel: `${toDateInputValue(serviceStart)} to ${toDateInputValue(serviceEnd)}`,
  };
}

function isFreeRentCycle(params: {
  paymentStartDate: string;
  freeRentCycles: number;
  cycleStart: string;
}) {
  const cycleIndex = getBillingCycleIndex(
    new Date(params.paymentStartDate),
    new Date(params.cycleStart)
  );

  return cycleIndex > -1 && cycleIndex < params.freeRentCycles;
}

function deriveWholeMonths(amount: number, baseRent: number) {
  if (amount <= 0 || baseRent <= 0) {
    return 0;
  }

  const ratio = amount / baseRent;
  const rounded = Math.round(ratio);

  return Math.abs(ratio - rounded) < 0.01 ? rounded : 0;
}

function buildAdvanceApplicationCycleIndexes(params: {
  totalCycles: number;
  freeRentCycles: number;
  advanceRentMonths: number;
  application: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
}) {
  const { totalCycles, freeRentCycles, advanceRentMonths, application } = params;
  const billableCycleIndexes = Array.from({ length: totalCycles }, (_, index) => index)
    .filter((index) => index >= freeRentCycles);

  return new Set(
    application === "LAST_BILLABLE_CYCLES"
      ? billableCycleIndexes.slice(-advanceRentMonths)
      : billableCycleIndexes.slice(0, advanceRentMonths)
  );
}

function getCycleCount(paymentStartDate: string, endDate: string) {
  const anchorDate = new Date(paymentStartDate);
  const contractEndDate = new Date(endDate);
  let count = 0;

  while (count < 240) {
    const cycleStart = addMonthsClamped(anchorDate, count);

    if (new Date(cycleStart).getTime() > contractEndDate.getTime()) {
      break;
    }

    count += 1;
  }

  return count;
}

function getAdvanceRentEffects(params: {
  paymentStartDate: string;
  endDate: string;
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
  advanceRent: string;
  cycleStart: string;
  rentAmount: string;
}) {
  const baseRent = Number(params.rentAmount);
  const parsedAdvanceRent = Number(params.advanceRent);
  const resolvedAdvanceRentMonths =
    params.advanceRentMonths > 0
      ? params.advanceRentMonths
      : deriveWholeMonths(parsedAdvanceRent, baseRent);

  if (resolvedAdvanceRentMonths <= 0) {
    return {
      charge: "",
      credit: "",
    };
  }

  const cycleIndex = getBillingCycleIndex(
    new Date(params.paymentStartDate),
    new Date(params.cycleStart)
  );

  if (cycleIndex < 0) {
    return {
      charge: "",
      credit: "",
    };
  }

  const totalCycles = getCycleCount(params.paymentStartDate, params.endDate);
  const advanceApplicationCycleIndexes = buildAdvanceApplicationCycleIndexes({
    totalCycles,
    freeRentCycles: params.freeRentCycles,
    advanceRentMonths: resolvedAdvanceRentMonths,
    application: params.advanceRentApplication,
  });
  const isFreeRent = cycleIndex < params.freeRentCycles;
  const creditAmount =
    !isFreeRent && advanceApplicationCycleIndexes.has(cycleIndex)
      ? Math.min(baseRent, baseRent).toFixed(2)
      : "";

  return {
    charge: cycleIndex === 0 && parsedAdvanceRent > 0 ? parsedAdvanceRent.toFixed(2) : "",
    credit: creditAmount,
  };
}

function buildRowsForSelection(
  contractOptions: ContractOption[],
  tenantId: string,
  contractFilter: string
) {
  return contractOptions
    .filter((contract) => contract.tenantId === tenantId)
    .filter((contract) => contractFilter === "ALL" || contract.id === contractFilter)
    .flatMap((contract) =>
      contract.pendingBacklogCycles.map((cycle) => {
        const autoAdvanceRentEffects = getAdvanceRentEffects({
          paymentStartDate: contract.paymentStartDate,
          endDate: contract.endDate,
          freeRentCycles: contract.freeRentCycles,
          advanceRentMonths: contract.advanceRentMonths,
          advanceRentApplication: contract.advanceRentApplication,
          advanceRent: contract.advanceRent,
          cycleStart: cycle.start,
          rentAmount: contract.monthlyRent,
        });

        return {
          selected: true,
          rowKey: `${contract.id}::${cycle.key}`,
          tenantId: contract.tenantId,
          contractId: contract.id,
          contractLabel: `${contract.property.propertyCode} · ${contract.property.name}`,
          billingMonthLabel: cycle.label,
          billingPeriodStart: toDateInputValue(new Date(cycle.start)),
          billingPeriodEnd: toDateInputValue(new Date(cycle.end)),
          autoFreeRent: isFreeRentCycle({
            paymentStartDate: contract.paymentStartDate,
            freeRentCycles: contract.freeRentCycles,
            cycleStart: cycle.start,
          }),
          autoAdvanceRentCredit: autoAdvanceRentEffects.credit,
          issueDate: toDateInputValue(new Date(cycle.end)),
          dueDate: addDays(toDateInputValue(new Date(cycle.end)), 7),
          rentAmount: contract.monthlyRent,
          manualUtilityAmount: "",
          utilityNote: "",
          adjustmentAmount: "",
          arrearsAmount: "",
          paymentStatus: "UNPAID" as const,
          paymentAmount: "",
          paymentDate: "",
          referenceNumber: "",
          notes: "",
          readingMissing: false,
        };
      })
    );
}

export function HistoricalBacklogBulkTable({
  formAction,
  contractOptions,
  cutoffLabel,
  onNeedsDetail,
}: HistoricalBacklogBulkTableProps) {
  const [state, setState] = useState<HistoricalBacklogBulkFormState>(initialState);
  const [pending, startTransition] = useTransition();
  const tenantOptions = useMemo(
    () =>
      Array.from(
        new Map(
          contractOptions.map((contract) => [
            contract.tenantId,
            {
              id: contract.tenantId,
              label: formatTenantName(contract.tenant),
            },
          ])
        ).values()
      ).sort((left, right) => left.label.localeCompare(right.label)),
    [contractOptions]
  );
  const [selectedTenantId, setSelectedTenantId] = useState(
    tenantOptions[0]?.id ?? ""
  );
  const [contractFilter, setContractFilter] = useState("ALL");
  const [rows, setRows] = useState<BulkRow[]>(() =>
    buildRowsForSelection(contractOptions, tenantOptions[0]?.id ?? "", "ALL")
  );
  const failedRowCount = Object.keys(state.rowErrors ?? {}).filter(
    (key) => key !== "_form"
  ).length;
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
  const savedRowMap = useMemo(
    () => new Map((state.savedRows ?? []).map((row) => [row.rowKey, row.invoiceId])),
    [state.savedRows]
  );
  const visibleRows = useMemo(
    () => rows,
    [rows]
  );
  const selectedRows = useMemo(
    () => visibleRows.filter((row) => row.selected),
    [visibleRows]
  );
  const submittableSelectedRows = useMemo(
    () => selectedRows.filter((row) => !savedRowMap.has(row.rowKey)),
    [savedRowMap, selectedRows]
  );
  const allVisibleSelected =
    visibleRows.length > 0 && selectedRows.length === visibleRows.length;

  const visibleContracts = contractOptions.filter(
    (contract) => contract.tenantId === selectedTenantId
  );

  function resetRows(nextTenantId: string, nextContractFilter: string) {
    setRows(buildRowsForSelection(contractOptions, nextTenantId, nextContractFilter));
    setState(initialState);
  }

  function handleTenantChange(nextTenantId: string) {
    setSelectedTenantId(nextTenantId);
    setContractFilter("ALL");
    resetRows(nextTenantId, "ALL");
  }

  function handleContractFilterChange(nextContractFilter: string) {
    setContractFilter(nextContractFilter);
    resetRows(selectedTenantId, nextContractFilter);
  }

  function updateRow(
    rowKey: string,
    key: keyof BulkRow,
    value: string | boolean
  ) {
    setRows((current) =>
      current.map((row) => (row.rowKey === rowKey ? { ...row, [key]: value } : row))
    );
  }

  function updateAllVisibleRows(selected: boolean) {
    const visibleRowKeys = new Set(visibleRows.map((row) => row.rowKey));

    setRows((current) =>
      current.map((row) =>
        visibleRowKeys.has(row.rowKey) ? { ...row, selected } : row
      )
    );
  }

  const serializedRows = JSON.stringify(
    submittableSelectedRows.map((row) => ({
      rowKey: row.rowKey,
      contractId: row.contractId,
      billingPeriodStart: row.billingPeriodStart,
      billingPeriodEnd: row.billingPeriodEnd,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      rentAmount: row.rentAmount,
      manualUtilityAmount: row.manualUtilityAmount,
      utilityNote: row.utilityNote,
      adjustmentAmount: row.adjustmentAmount,
      arrearsAmount: row.arrearsAmount,
      paymentStatus: row.paymentStatus,
      paymentAmount: row.paymentAmount,
      paymentDate: row.paymentDate,
      referenceNumber: row.referenceNumber,
      notes: row.notes,
      readingMissing: row.readingMissing,
    }))
  );

  function submitRows(formData: FormData) {
    startTransition(async () => {
      const nextState = await formAction(state, formData);
      setState(nextState);
    });
  }

  return (
    <form action={submitRows} className="space-y-6">
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
                  onChange={(event) => handleContractFilterChange(event.target.value)}
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
                  {selectedRows.length} selected of {visibleRows.length} row(s) through transition month {cutoffLabel}
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
            {visibleRows.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                No missing historical months in this filter. Change business or contract
                scope to load more rows.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">
                        <label className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={(event) =>
                              updateAllVisibleRows(event.target.checked)
                            }
                            className="size-4 rounded border-border text-primary"
                            aria-label="Select all visible months"
                          />
                        </label>
                      </TableHead>
                      <TableHead className="min-w-44">Contract</TableHead>
                      <TableHead className="min-w-32">Month</TableHead>
                      <TableHead className="min-w-32">Issue</TableHead>
                      <TableHead className="min-w-32">Due</TableHead>
                      <TableHead className="min-w-32">Rent</TableHead>
                      <TableHead className="min-w-36">Manual utility</TableHead>
                      <TableHead className="min-w-44">Utility note</TableHead>
                      <TableHead className="min-w-32">Adjustment</TableHead>
                      <TableHead className="min-w-32">Arrears</TableHead>
                      <TableHead className="min-w-32">Payment</TableHead>
                      <TableHead className="min-w-32">Paid amount</TableHead>
                      <TableHead className="min-w-32">Payment date</TableHead>
                      <TableHead className="min-w-36">Reference</TableHead>
                      <TableHead className="min-w-48">Notes</TableHead>
                      <TableHead className="min-w-32">Reading missing</TableHead>
                      <TableHead className="min-w-36 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row) => {
                      const rowErrors = state.rowErrors?.[row.rowKey] ?? [];

                      return (
                        <TableRow key={row.rowKey} className="align-top">
                          <TableCell>
                            <label className="flex min-h-10 items-center justify-center">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={(event) =>
                                  updateRow(
                                    row.rowKey,
                                    "selected",
                                    event.target.checked
                                  )
                                }
                                className="size-4 rounded border-border text-primary"
                                aria-label={`Generate ${row.billingMonthLabel}`}
                              />
                            </label>
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.contractLabel}
                            {rowErrors.length > 0 ? (
                              <div className="mt-2 space-y-1">
                                {rowErrors.map((error, index) => (
                                  <p
                                    key={`${row.rowKey}-error-${index}`}
                                    className="text-xs text-destructive"
                                  >
                                    {error}
                                  </p>
                                ))}
                              </div>
                            ) : savedRowMap.has(row.rowKey) ? (
                              <p className="mt-2 text-xs text-emerald-600">
                                Saved as backlog invoice.
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                Rent: {row.billingMonthLabel}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Utility service:{" "}
                                {getUtilityServiceWindow(row.billingPeriodStart).label}
                              </p>
                              {row.autoFreeRent ? (
                                <p className="text-xs text-muted-foreground">
                                  Auto free-rent concession applies to this month.
                                </p>
                              ) : null}
                              {row.autoAdvanceRentCredit ? (
                                <p className="text-xs text-muted-foreground">
                                  Auto advance-rent credit: {row.autoAdvanceRentCredit}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={row.issueDate}
                              onChange={(event) =>
                                updateRow(row.rowKey, "issueDate", event.target.value)
                              }
                              className="field-blank h-10 min-w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={row.dueDate}
                              onChange={(event) =>
                                updateRow(row.rowKey, "dueDate", event.target.value)
                              }
                              className="field-blank h-10 min-w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.rentAmount}
                              onChange={(event) =>
                                updateRow(row.rowKey, "rentAmount", event.target.value)
                              }
                              className="field-blank h-10 min-w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.manualUtilityAmount}
                              onChange={(event) =>
                                updateRow(
                                  row.rowKey,
                                  "manualUtilityAmount",
                                  event.target.value
                                )
                              }
                              className="field-blank h-10 min-w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.utilityNote}
                              onChange={(event) =>
                                updateRow(row.rowKey, "utilityNote", event.target.value)
                              }
                              className="field-blank h-10 min-w-40"
                              placeholder="Optional"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.adjustmentAmount}
                              onChange={(event) =>
                                updateRow(
                                  row.rowKey,
                                  "adjustmentAmount",
                                  event.target.value
                                )
                              }
                              className="field-blank h-10 min-w-28"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.arrearsAmount}
                              onChange={(event) =>
                                updateRow(
                                  row.rowKey,
                                  "arrearsAmount",
                                  event.target.value
                                )
                              }
                              className="field-blank h-10 min-w-28"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              value={row.paymentStatus}
                              onChange={(event) =>
                                updateRow(
                                  row.rowKey,
                                  "paymentStatus",
                                  event.target.value
                                )
                              }
                              className={selectClassName}
                            >
                              {BACKLOG_PAYMENT_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {BACKLOG_PAYMENT_STATUS_LABELS[status]}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.paymentAmount}
                              onChange={(event) =>
                                updateRow(
                                  row.rowKey,
                                  "paymentAmount",
                                  event.target.value
                                )
                              }
                              className="field-blank h-10 min-w-28"
                              disabled={row.paymentStatus !== "PARTIAL"}
                              placeholder={
                                row.paymentStatus === "PAID" ? "Auto full" : "0.00"
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={row.paymentDate}
                              onChange={(event) =>
                                updateRow(
                                  row.rowKey,
                                  "paymentDate",
                                  event.target.value
                                )
                              }
                              className="field-blank h-10 min-w-28"
                              disabled={row.paymentStatus === "UNPAID"}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.referenceNumber}
                              onChange={(event) =>
                                updateRow(
                                  row.rowKey,
                                  "referenceNumber",
                                  event.target.value
                                )
                              }
                              className="field-blank h-10 min-w-32"
                              placeholder="Optional"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.notes}
                              onChange={(event) =>
                                updateRow(row.rowKey, "notes", event.target.value)
                              }
                              className="field-blank h-10 min-w-44"
                              placeholder="Optional"
                            />
                          </TableCell>
                          <TableCell>
                            <label className="flex min-h-10 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={row.readingMissing}
                                onChange={(event) =>
                                  updateRow(
                                    row.rowKey,
                                    "readingMissing",
                                    event.target.checked
                                  )
                                }
                                className="size-4 rounded border-border text-primary"
                              />
                              Missing
                            </label>
                          </TableCell>
                          <TableCell className="text-right">
                            {savedRowMap.has(row.rowKey) ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  render={<Link href={`/billing/${savedRowMap.get(row.rowKey)}`} />}
                                  variant="outline"
                                  className="button-blank h-10 rounded-xl"
                                >
                                  <Eye />
                                  Open
                                </Button>
                                <Button
                                  render={<Link href={`/billing/${savedRowMap.get(row.rowKey)}/edit`} />}
                                  variant="outline"
                                  className="button-blank h-10 rounded-xl"
                                >
                                  <FilePenLine />
                                  Edit
                                </Button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                className="button-blank h-10 rounded-xl"
                                onClick={() =>
                                  onNeedsDetail({
                                    tenantId: row.tenantId,
                                    contractId: row.contractId,
                                    cycleKey: row.rowKey.split("::").slice(1).join("::"),
                                  })
                                }
                              >
                                <ArrowRight />
                                Needs detail
                              </Button>
                            )}
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

        <aside className="space-y-4">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              Bulk backlog
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              Spreadsheet-style entry
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Fill missing historical invoice months fast. Use manual utility totals
              when old readings are lost, then send special rows to detailed month form
              only when true meter chronology is needed.
            </p>

            <div className="mt-5 space-y-3 rounded-[1.2rem] border border-border/60 bg-background/60 px-4 py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Visible rows</span>
                <span className="font-medium">{visibleRows.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Selected rows</span>
                <span className="font-medium">{selectedRows.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Ready to save</span>
                <span className="font-medium">{submittableSelectedRows.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Save mode</span>
                <span className="font-medium">Partial save</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Missing reading</span>
                <span className="font-medium">Manual total allowed</span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending || submittableSelectedRows.length === 0}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                Save selected rows
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
                onClick={() => resetRows(selectedTenantId, contractFilter)}
              >
                <RotateCcw />
                Reload rows
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
