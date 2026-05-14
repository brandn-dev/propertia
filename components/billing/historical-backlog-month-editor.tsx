"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BACKLOG_ADJUSTMENT_TYPE_LABELS,
  BACKLOG_ADJUSTMENT_TYPES,
  BACKLOG_PAYMENT_STATUS_LABELS,
  BACKLOG_PAYMENT_STATUSES,
  RECURRING_CHARGE_TYPE_LABELS,
  UTILITY_TYPE_LABELS,
} from "@/lib/form-options";
import {
  buildLocalId,
  createUtilityReadingDraft,
  getApplicableRecurringChargeRows,
  getAutoAdvanceRentEffects,
  getAutoFreeRentConcessionAmount,
  getUtilityServiceWindow,
  type HistoricalBacklogContractOption,
  type HistoricalBacklogCycleOption,
  type HistoricalBacklogMonthDraft,
} from "@/lib/billing/historical-backlog-drafts";
import { toDateInputValue } from "@/lib/format";

const selectClassName = "select-blank";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

type HistoricalBacklogMonthEditorProps = {
  contract: HistoricalBacklogContractOption | null;
  cycle: HistoricalBacklogCycleOption | null;
  draft: HistoricalBacklogMonthDraft | null;
  fieldErrors?: Record<string, string[] | undefined>;
  summaryErrors?: string[];
  validationMessages?: string[];
  onChange: (
    updater: (draft: HistoricalBacklogMonthDraft) => HistoricalBacklogMonthDraft
  ) => void;
};

export function HistoricalBacklogMonthEditor({
  contract,
  cycle,
  draft,
  fieldErrors,
  summaryErrors,
  validationMessages,
  onChange,
}: HistoricalBacklogMonthEditorProps) {
  if (!contract || !cycle || !draft) {
    return (
      <div className="border-blank rounded-xl p-6 text-sm text-muted-foreground">
        Select backlog month.
      </div>
    );
  }

  const utilityServiceWindow = getUtilityServiceWindow(cycle.start);
  const autoFreeRentConcessionAmount = getAutoFreeRentConcessionAmount({
    paymentStartDate: contract.paymentStartDate,
    freeRentCycles: contract.freeRentCycles,
    cycleStart: cycle.start,
    rentAmount: draft.rentAmount,
  });
  const autoAdvanceRentEffects = getAutoAdvanceRentEffects({
    paymentStartDate: contract.paymentStartDate,
    endDate: contract.endDate,
    freeRentCycles: contract.freeRentCycles,
    advanceRentMonths: contract.advanceRentMonths,
    advanceRentApplication: contract.advanceRentApplication,
    advanceRentFirstMonths: contract.advanceRentFirstMonths,
    advanceRentLastMonths: contract.advanceRentLastMonths,
    advanceRent: contract.advanceRent,
    cycleStart: cycle.start,
    rentAmount: draft.rentAmount,
  });
  const monthErrors = Array.from(
    new Set([...(summaryErrors ?? []), ...(validationMessages ?? [])])
  );

  return (
    <div className="space-y-6">
      <div className="border-blank space-y-6 rounded-xl p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Rent month</Label>
            <div className="field-blank flex min-h-11 items-center rounded-xl border px-4 text-sm text-muted-foreground">
              {cycle.label} · {toDateInputValue(new Date(cycle.start))} to{" "}
              {toDateInputValue(new Date(cycle.end))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Utility service month</Label>
            <div className="field-blank flex min-h-11 items-center rounded-xl border px-4 text-sm text-muted-foreground">
              {utilityServiceWindow.label} · {utilityServiceWindow.rangeLabel}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${draft.rowKey}-issueDate`}>Issue date</Label>
            <Input
              id={`${draft.rowKey}-issueDate`}
              type="date"
              value={draft.issueDate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  issueDate: event.target.value,
                }))
              }
              className="field-blank h-11"
            />
            <FieldError message={fieldErrors?.issueDate?.[0]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${draft.rowKey}-dueDate`}>Due date</Label>
            <Input
              id={`${draft.rowKey}-dueDate`}
              type="date"
              value={draft.dueDate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  dueDate: event.target.value,
                }))
              }
              className="field-blank h-11"
            />
            <FieldError message={fieldErrors?.dueDate?.[0]} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${draft.rowKey}-rentAmount`}>Rent amount override</Label>
            <Input
              id={`${draft.rowKey}-rentAmount`}
              type="number"
              min="0"
              step="0.01"
              value={draft.rentAmount}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  rentAmount: event.target.value,
                }))
              }
              className="field-blank h-11"
              placeholder="Leave blank if this month has no rent line."
            />
            <FieldError message={fieldErrors?.rentAmount?.[0]} />
            {autoFreeRentConcessionAmount > 0 ? (
              <p className="text-sm text-muted-foreground">
                Free-rent cycle detected. Matching concession of{" "}
                {autoFreeRentConcessionAmount.toFixed(2)} applies automatically on
                save.
              </p>
            ) : null}
            {autoAdvanceRentEffects.creditAmount > 0 ? (
              <p className="text-sm text-muted-foreground">
                Advance-rent credit of{" "}
                {autoAdvanceRentEffects.creditAmount.toFixed(2)} applies
                automatically on save.
              </p>
            ) : null}
          </div>
        </div>

        {monthErrors.length > 0 ? (
          <div className="rounded-[1.2rem] border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {monthErrors.map((error, index) => (
              <p key={`${draft.rowKey}-summary-${index}`}>{error}</p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-blank rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em]">
              Recurring charges
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Applicable contract recurring charges load automatically for this
              backlog month. Remove any line you do not want on invoice.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="button-blank rounded-full"
            onClick={() =>
              onChange((current) => ({
                ...current,
                recurringCharges: getApplicableRecurringChargeRows(contract, cycle),
              }))
            }
          >
            <Plus />
            Restore recurring
          </Button>
        </div>
        <FieldError message={fieldErrors?.recurringChargeIds?.[0]} />

        <div className="mt-6 space-y-4">
          {draft.recurringCharges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recurring charges currently selected for this backlog month.
            </p>
          ) : (
            draft.recurringCharges.map((row) => (
              <div
                key={row.recurringChargeId}
                className="rounded-[1.35rem] border border-border/60 bg-background/55 p-4"
              >
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {row.label} · {RECURRING_CHARGE_TYPE_LABELS[row.chargeType]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Effective {toDateInputValue(new Date(row.effectiveStartDate))}
                      {row.effectiveEndDate
                        ? ` to ${toDateInputValue(new Date(row.effectiveEndDate))}`
                        : " onward"}
                    </p>
                  </div>
                  <div className="text-sm font-medium md:text-right">
                    ₱{Number(row.amount).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="button-blank h-11 rounded-xl"
                      onClick={() =>
                        onChange((current) => ({
                          ...current,
                          recurringCharges: current.recurringCharges.filter(
                            (charge) =>
                              charge.recurringChargeId !== row.recurringChargeId
                          ),
                        }))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border-blank rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em]">
              Utility readings
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Real meter chronology only. Previous reading carries from earlier
              saved or unsaved backlog months.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="button-blank rounded-full"
            onClick={() =>
              onChange((current) => ({
                ...current,
                utilityReadings: [
                  ...current.utilityReadings,
                  createUtilityReadingDraft(contract, cycle),
                ],
              }))
            }
            disabled={contract.meters.length === 0}
          >
            <Plus />
            Add reading
          </Button>
        </div>
        <FieldError message={fieldErrors?.utilityReadings?.[0]} />

        {contract.meters.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No dedicated tenant meters on this contract. Use manual utility charges.
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {draft.utilityReadings.map((row) => (
            <div
              key={row.id}
              className="rounded-[1.35rem] border border-border/60 bg-background/55 p-4"
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <div className="space-y-2 xl:col-span-2">
                  <Label>Meter</Label>
                  <select
                    value={row.meterId}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        utilityReadings: current.utilityReadings.map((entry) =>
                          entry.id === row.id
                            ? {
                                ...entry,
                                meterId: event.target.value,
                                ratePerUnitMode: "auto",
                              }
                            : entry
                        ),
                      }))
                    }
                    className={selectClassName}
                  >
                    <option value="">Select meter</option>
                    {contract.meters.map((meter) => (
                      <option key={meter.id} value={meter.id}>
                        {meter.meterCode} · {UTILITY_TYPE_LABELS[meter.utilityType]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Reading date</Label>
                  <Input
                    type="date"
                    value={row.readingDate}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        utilityReadings: current.utilityReadings.map((entry) =>
                          entry.id === row.id
                            ? {
                                ...entry,
                                readingDate: event.target.value,
                                ratePerUnitMode: "auto",
                              }
                            : entry
                        ),
                      }))
                    }
                    className="field-blank h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Previous</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.previousReading}
                    readOnly
                    className="field-blank h-11 bg-muted/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Current</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.currentReading}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        utilityReadings: current.utilityReadings.map((entry) =>
                          entry.id === row.id
                            ? { ...entry, currentReading: event.target.value }
                            : entry
                        ),
                      }))
                    }
                    className="field-blank h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rate</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.ratePerUnit}
                      onChange={(event) =>
                        onChange((current) => ({
                          ...current,
                          utilityReadings: current.utilityReadings.map((entry) =>
                            entry.id === row.id
                              ? {
                                  ...entry,
                                  ratePerUnit: event.target.value,
                                  ratePerUnitMode: "manual",
                                }
                              : entry
                          ),
                        }))
                      }
                      className="field-blank h-11"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="button-blank h-11 rounded-xl"
                      onClick={() =>
                        onChange((current) => ({
                          ...current,
                          utilityReadings: current.utilityReadings.filter(
                            (entry) => entry.id !== row.id
                          ),
                        }))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-blank rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em]">
              Manual utility charges
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use when old utility amounts are known but safe meter insertion is not
              possible.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="button-blank rounded-full"
            onClick={() =>
              onChange((current) => ({
                ...current,
                utilityCharges: [
                  ...current.utilityCharges,
                  {
                    id: buildLocalId(),
                    utilityType: "WATER",
                    label: "",
                    amount: "",
                  },
                ],
              }))
            }
          >
            <Plus />
            Add utility charge
          </Button>
        </div>
        <FieldError message={fieldErrors?.utilityCharges?.[0]} />

        <div className="mt-6 space-y-4">
          {draft.utilityCharges.map((row) => (
            <div
              key={row.id}
              className="rounded-[1.35rem] border border-border/60 bg-background/55 p-4"
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label>Utility</Label>
                  <select
                    value={row.utilityType}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        utilityCharges: current.utilityCharges.map((entry) =>
                          entry.id === row.id
                            ? {
                                ...entry,
                                utilityType:
                                  event.target
                                    .value as keyof typeof UTILITY_TYPE_LABELS,
                              }
                            : entry
                        ),
                      }))
                    }
                    className={selectClassName}
                  >
                    {Object.entries(UTILITY_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 xl:col-span-2">
                  <Label>Label</Label>
                  <Input
                    value={row.label}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        utilityCharges: current.utilityCharges.map((entry) =>
                          entry.id === row.id
                            ? { ...entry, label: event.target.value }
                            : entry
                        ),
                      }))
                    }
                    className="field-blank h-11"
                    placeholder="Optional note or bill reference"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.amount}
                      onChange={(event) =>
                        onChange((current) => ({
                          ...current,
                          utilityCharges: current.utilityCharges.map((entry) =>
                            entry.id === row.id
                              ? { ...entry, amount: event.target.value }
                              : entry
                          ),
                        }))
                      }
                      className="field-blank h-11"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="button-blank h-11 rounded-xl"
                      onClick={() =>
                        onChange((current) => ({
                          ...current,
                          utilityCharges: current.utilityCharges.filter(
                            (entry) => entry.id !== row.id
                          ),
                        }))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-blank rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em]">
              Other charges and credits
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Add arrears, manual adjustments, or negative credits that change final
              invoice total.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="button-blank rounded-full"
            onClick={() =>
              onChange((current) => ({
                ...current,
                adjustments: [
                  ...current.adjustments,
                  {
                    id: buildLocalId(),
                    itemType: "ADJUSTMENT",
                    label: "",
                    amount: "",
                  },
                ],
              }))
            }
          >
            <Plus />
            Add line
          </Button>
        </div>
        <FieldError message={fieldErrors?.adjustments?.[0]} />

        <div className="mt-6 space-y-4">
          {draft.adjustments.map((row) => (
            <div
              key={row.id}
              className="rounded-[1.35rem] border border-border/60 bg-background/55 p-4"
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    value={row.itemType}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        adjustments: current.adjustments.map((entry) =>
                          entry.id === row.id
                            ? {
                                ...entry,
                                itemType:
                                  event.target
                                    .value as (typeof BACKLOG_ADJUSTMENT_TYPES)[number],
                              }
                            : entry
                        ),
                      }))
                    }
                    className={selectClassName}
                  >
                    {BACKLOG_ADJUSTMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {BACKLOG_ADJUSTMENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 xl:col-span-2">
                  <Label>Label</Label>
                  <Input
                    value={row.label}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        adjustments: current.adjustments.map((entry) =>
                          entry.id === row.id
                            ? { ...entry, label: event.target.value }
                            : entry
                        ),
                      }))
                    }
                    className="field-blank h-11"
                    placeholder="Security, credit memo, prior balance, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={(event) =>
                        onChange((current) => ({
                          ...current,
                          adjustments: current.adjustments.map((entry) =>
                            entry.id === row.id
                              ? { ...entry, amount: event.target.value }
                              : entry
                          ),
                        }))
                      }
                      className="field-blank h-11"
                      placeholder="-500.00 or 500.00"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="button-blank h-11 rounded-xl"
                      onClick={() =>
                        onChange((current) => ({
                          ...current,
                          adjustments: current.adjustments.filter(
                            (entry) => entry.id !== row.id
                          ),
                        }))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-blank rounded-xl p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${draft.rowKey}-paymentStatus`}>Payment snapshot</Label>
            <select
              id={`${draft.rowKey}-paymentStatus`}
              value={draft.payment.status}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  payment: {
                    ...current.payment,
                    status:
                      event.target.value as (typeof BACKLOG_PAYMENT_STATUSES)[number],
                  },
                }))
              }
              className={selectClassName}
            >
              {BACKLOG_PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {BACKLOG_PAYMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          {draft.payment.status === "PARTIAL" ? (
            <div className="space-y-2">
              <Label htmlFor={`${draft.rowKey}-paymentAmount`}>
                Partial payment amount
              </Label>
              <Input
                id={`${draft.rowKey}-paymentAmount`}
                type="number"
                min="0"
                step="0.01"
                value={draft.payment.amount}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    payment: {
                      ...current.payment,
                      amount: event.target.value,
                    },
                  }))
                }
                className="field-blank h-11"
              />
              <FieldError message={fieldErrors?.paymentAmount?.[0]} />
            </div>
          ) : null}

          {draft.payment.status !== "UNPAID" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${draft.rowKey}-paymentDate`}>Payment date</Label>
                <Input
                  id={`${draft.rowKey}-paymentDate`}
                  type="date"
                  value={draft.payment.paymentDate}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      payment: {
                        ...current.payment,
                        paymentDate: event.target.value,
                      },
                    }))
                  }
                  className="field-blank h-11"
                />
                <FieldError message={fieldErrors?.paymentDate?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${draft.rowKey}-referenceNumber`}>
                  Reference number
                </Label>
                <Input
                  id={`${draft.rowKey}-referenceNumber`}
                  value={draft.payment.referenceNumber}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      payment: {
                        ...current.payment,
                        referenceNumber: event.target.value,
                      },
                    }))
                  }
                  className="field-blank h-11"
                  placeholder="Optional OR / receipt reference"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${draft.rowKey}-paymentNotes`}>Payment notes</Label>
                <Textarea
                  id={`${draft.rowKey}-paymentNotes`}
                  value={draft.payment.notes}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      payment: {
                        ...current.payment,
                        notes: event.target.value,
                      },
                    }))
                  }
                  className="field-blank min-h-24"
                  placeholder="Optional remarks for historical payment record."
                />
              </div>
            </>
          ) : null}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${draft.rowKey}-notes`}>Month notes</Label>
            <Textarea
              id={`${draft.rowKey}-notes`}
              value={draft.notes}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className="field-blank min-h-24"
              placeholder="Optional context for this historical month."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
