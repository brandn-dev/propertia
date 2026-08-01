"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import type { BacklogInvoiceEditFormState } from "@/app/(dashboard)/billing/[invoiceId]/edit/actions";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/ui/toast-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const initialState: BacklogInvoiceEditFormState = {};

type AvailableMeter = {
  id: string;
  meterCode: string;
  utilityType: keyof typeof UTILITY_TYPE_LABELS;
};

type EditableItem = {
  id: string;
  itemType: string;
  description: string;
  amount: string;
  mode: "manual" | "meter";
  isNew?: boolean;
  meterId?: string;
  meterReadingId?: string;
  meterCode?: string;
  utilityType?: keyof typeof UTILITY_TYPE_LABELS;
  readingDate?: string;
  previousReading?: string;
  currentReading?: string;
  ratePerUnit?: string;
};

type ReadOnlyItem = {
  id: string;
  itemType: string;
  description: string;
  amount: string;
};

type BacklogInvoiceEditFormProps = {
  invoiceId: string;
  availableMeters: AvailableMeter[];
  initialValues: {
    issueDate: string;
    dueDate: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    notes: string;
    editableItems: EditableItem[];
    readOnlyItems: ReadOnlyItem[];
  };
  formAction: (
    state: BacklogInvoiceEditFormState,
    formData: FormData
  ) => Promise<BacklogInvoiceEditFormState>;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function buildDraftId() {
  return `new-${Math.random().toString(36).slice(2, 10)}`;
}

function toPreviewNumber(value?: string) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function toDisplayNumber(value?: string) {
  const parsed = toPreviewNumber(value);
  return parsed === null ? "" : parsed.toFixed(2);
}

function getTimelineTimestamp(value?: string) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getPreviousPreview(item: EditableItem, items: EditableItem[]) {
  if (!item.isNew) {
    return toDisplayNumber(item.previousReading) || "0.00";
  }

  const readingTimestamp = getTimelineTimestamp(item.readingDate);

  if (!item.meterId || readingTimestamp === null) {
    return "";
  }

  const siblingRows = items
    .filter(
      (entry) =>
        entry.mode === "meter" &&
        entry.meterId === item.meterId &&
        entry.id !== item.id &&
        getTimelineTimestamp(entry.readingDate) !== null
    )
    .sort((left, right) => {
      const leftTimestamp = getTimelineTimestamp(left.readingDate) ?? 0;
      const rightTimestamp = getTimelineTimestamp(right.readingDate) ?? 0;
      return leftTimestamp - rightTimestamp;
    });

  const previousRow = [...siblingRows].reverse().find((entry) => {
    const entryTimestamp = getTimelineTimestamp(entry.readingDate);
    return entryTimestamp !== null && entryTimestamp < readingTimestamp;
  });
  const previousRowValue = toDisplayNumber(previousRow?.currentReading);

  if (previousRowValue) {
    return previousRowValue;
  }

  const nextRow = siblingRows.find((entry) => {
    const entryTimestamp = getTimelineTimestamp(entry.readingDate);
    return entryTimestamp !== null && entryTimestamp > readingTimestamp;
  });

  return toDisplayNumber(nextRow?.previousReading);
}

function getUsagePreview(currentReading?: string, previousReading?: string) {
  const currentValue = toPreviewNumber(currentReading);
  const previousValue = toPreviewNumber(previousReading);

  if (currentValue === null || previousValue === null) {
    return null;
  }

  return Math.max(0, currentValue - previousValue);
}

function getAmountPreview(usage: number | null, ratePerUnit?: string) {
  const rateValue = toPreviewNumber(ratePerUnit);

  if (usage === null || rateValue === null) {
    return null;
  }

  return usage * rateValue;
}

function getPreviewLabel(value: number | null, formatter?: (input: number) => string) {
  if (value === null) {
    return "Auto";
  }

  return formatter ? formatter(value) : value.toFixed(2);
}

export function BacklogInvoiceEditForm({
  invoiceId,
  availableMeters,
  initialValues,
  formAction,
}: BacklogInvoiceEditFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  useActionToast({
    message: state.message,
    title: "Backlog invoice blocked",
    intent: "error",
  });
  const [editableItems, setEditableItems] = useState(initialValues.editableItems);
  const serializedItems = JSON.stringify(editableItems);
  const meterById = new Map(availableMeters.map((meter) => [meter.id, meter]));
  const manualItems = editableItems.filter((item) => item.mode === "manual");
  const meterItems = editableItems.filter((item) => item.mode === "meter");

  function updateItem(
    itemId: string,
    key:
      | "description"
      | "amount"
      | "meterId"
      | "readingDate"
      | "previousReading"
      | "currentReading"
      | "ratePerUnit",
    value: string
  ) {
    setEditableItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        if (key === "meterId") {
          const selectedMeter = meterById.get(value);

          return {
            ...item,
            meterId: value,
            meterCode: selectedMeter?.meterCode,
            utilityType: selectedMeter?.utilityType,
          };
        }

        return {
          ...item,
          [key]: value,
        };
      })
    );
  }

  function removeItem(itemId: string) {
    setEditableItems((current) => current.filter((item) => item.id !== itemId));
  }

  function addUtilityReadingItem() {
    const firstMeter = availableMeters[0];

    setEditableItems((current) => [
      ...current,
      {
        id: buildDraftId(),
        itemType: "UTILITY_READING",
        description: "",
        amount: "0.00",
        mode: "meter",
        isNew: true,
        meterId: firstMeter?.id ?? "",
        meterCode: firstMeter?.meterCode,
        utilityType: firstMeter?.utilityType,
        readingDate: initialValues.billingPeriodEnd,
        previousReading: "",
        currentReading: "",
        ratePerUnit: "",
      },
    ]);
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="invoiceId" value={invoiceId} readOnly />
      <input type="hidden" name="editableItems" value={serializedItems} readOnly />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="border-blank space-y-5 rounded-xl p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue date</Label>
              <Input
                id="issueDate"
                name="issueDate"
                type="date"
                defaultValue={initialValues.issueDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.issueDate?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={initialValues.dueDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.dueDate?.[0]} />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Rent month</Label>
              <div className="field-blank flex h-11 items-center rounded-xl border px-4 text-sm text-muted-foreground">
                {initialValues.billingPeriodStart} to {initialValues.billingPeriodEnd}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Utility reading window</Label>
              <div className="field-blank flex h-11 items-center rounded-xl border px-4 text-sm text-muted-foreground">
                Use dates inside invoice month only.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={initialValues.notes}
              className="field-blank min-h-28"
              placeholder="Internal note for this backlog invoice"
            />
          </div>
        </div>

        <div className="border-blank space-y-4 rounded-xl p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em]">
              Editable backlog lines
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Manual lines stay fully editable. Utility readings move below in full
              width so meter fields stay visible.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Free-rent and advance-rent adjustments are system-managed and
              recalculate automatically on save.
            </p>
          </div>

          <FieldError message={state.errors?.editableItems?.[0]} />

          {manualItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No manual backlog lines on this invoice.
            </p>
          ) : (
            <div className="space-y-4">
              {manualItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.25rem] border border-border/60 bg-background/60 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {item.itemType.replaceAll("_", " ")}
                  </p>
                  <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={item.description}
                        onChange={(event) =>
                          updateItem(item.id, "description", event.target.value)
                        }
                        className="field-blank h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(event) =>
                          updateItem(item.id, "amount", event.target.value)
                        }
                        className="field-blank h-11"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="border-blank space-y-4 rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em]">
              Utility reading lines
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Edit recorded backlog readings or add new rows in table form before
              saving. New rows must stay inside {initialValues.billingPeriodStart} to{" "}
              {initialValues.billingPeriodEnd}.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="button-blank rounded-full"
            onClick={addUtilityReadingItem}
            disabled={availableMeters.length === 0}
          >
            <Plus />
            Add utility reading
          </Button>
        </div>

        {availableMeters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No dedicated tenant meters are available on this contract.
          </p>
        ) : null}

        {meterItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No utility reading lines on this invoice yet.
          </p>
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="rounded-[1.25rem] border border-border/60 bg-background/40 p-3">
                <div className="overflow-x-auto">
                  <Table className="w-full min-w-[1120px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[220px]">Meter</TableHead>
                        <TableHead className="w-[160px]">Reading date</TableHead>
                        <TableHead className="w-[120px]">Previous</TableHead>
                        <TableHead className="w-[140px]">Current</TableHead>
                        <TableHead className="w-[110px]">Usage</TableHead>
                        <TableHead className="w-[140px]">Price / Rate</TableHead>
                        <TableHead className="w-[150px]">Amount</TableHead>
                        <TableHead className="w-[80px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meterItems.map((item) => {
                        const previousPreview = getPreviousPreview(item, meterItems);
                        const usagePreview = getUsagePreview(
                          item.currentReading,
                          previousPreview
                        );
                        const amountPreview = getAmountPreview(
                          usagePreview,
                          item.ratePerUnit
                        );

                        return (
                          <TableRow key={item.id} className="align-top">
                            <TableCell className="align-top">
                              {item.isNew ? (
                                <select
                                  value={item.meterId ?? ""}
                                  onChange={(event) =>
                                    updateItem(item.id, "meterId", event.target.value)
                                  }
                                  className="select-blank h-10 w-full"
                                >
                                  <option value="">Select meter</option>
                                  {availableMeters.map((meter) => (
                                    <option key={meter.id} value={meter.id}>
                                      {meter.meterCode} ·{" "}
                                      {UTILITY_TYPE_LABELS[meter.utilityType]}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="space-y-1">
                                  <p className="font-medium">{item.meterCode}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.utilityType
                                      ? UTILITY_TYPE_LABELS[item.utilityType]
                                      : "Utility"}
                                  </p>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="date"
                                value={item.readingDate ?? ""}
                                onChange={(event) =>
                                  updateItem(
                                    item.id,
                                    "readingDate",
                                    event.target.value
                                  )
                                }
                                className="field-blank h-10"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="field-blank flex h-10 items-center rounded-xl border px-3 text-sm text-muted-foreground">
                                {previousPreview || "Auto"}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.currentReading ?? ""}
                                onChange={(event) =>
                                  updateItem(
                                    item.id,
                                    "currentReading",
                                    event.target.value
                                  )
                                }
                                className="field-blank h-10"
                              />
                            </TableCell>
                            <TableCell className="align-top text-sm text-muted-foreground">
                              <div className="flex h-10 items-center">
                                {getPreviewLabel(usagePreview)}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.ratePerUnit ?? ""}
                                onChange={(event) =>
                                  updateItem(
                                    item.id,
                                    "ratePerUnit",
                                    event.target.value
                                  )
                                }
                                className="field-blank h-10"
                              />
                            </TableCell>
                            <TableCell className="align-top text-sm text-muted-foreground">
                              <div className="flex h-10 items-center font-medium text-foreground">
                                {getPreviewLabel(amountPreview, formatCurrency)}
                              </div>
                            </TableCell>
                            <TableCell className="align-top text-right">
                              {item.isNew ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="button-blank h-10 rounded-xl"
                                  onClick={() => removeItem(item.id)}
                                >
                                  <Trash2 />
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Saved
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="space-y-4 lg:hidden">
              {meterItems.map((item) => {
                const previousPreview = getPreviousPreview(item, meterItems);
                const usagePreview = getUsagePreview(
                  item.currentReading,
                  previousPreview
                );
                const amountPreview = getAmountPreview(
                  usagePreview,
                  item.ratePerUnit
                );

                return (
                  <div
                    key={item.id}
                    className="rounded-[1.25rem] border border-border/60 bg-background/40 p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Meter</Label>
                        {item.isNew ? (
                          <select
                            value={item.meterId ?? ""}
                            onChange={(event) =>
                              updateItem(item.id, "meterId", event.target.value)
                            }
                            className="select-blank"
                          >
                            <option value="">Select meter</option>
                            {availableMeters.map((meter) => (
                              <option key={meter.id} value={meter.id}>
                                {meter.meterCode} ·{" "}
                                {UTILITY_TYPE_LABELS[meter.utilityType]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="field-blank space-y-1 rounded-xl border px-3 py-2">
                            <p className="font-medium text-foreground">{item.meterCode}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.utilityType
                                ? UTILITY_TYPE_LABELS[item.utilityType]
                                : "Utility"}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Reading date</Label>
                        <Input
                          type="date"
                          value={item.readingDate ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, "readingDate", event.target.value)
                          }
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Previous</Label>
                        <div className="field-blank flex h-11 items-center rounded-xl border px-3 text-sm text-muted-foreground">
                          {previousPreview || "Auto"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Current</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.currentReading ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, "currentReading", event.target.value)
                          }
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Price / Rate</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.ratePerUnit ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, "ratePerUnit", event.target.value)
                          }
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Usage</Label>
                        <div className="field-blank flex h-11 items-center rounded-xl border px-3 text-sm text-muted-foreground">
                          {getPreviewLabel(usagePreview)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <div className="field-blank flex h-11 items-center rounded-xl border px-3 text-sm font-medium text-foreground">
                          {getPreviewLabel(amountPreview, formatCurrency)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Action</Label>
                        {item.isNew ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="button-blank h-11 w-full rounded-xl"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 />
                            Remove row
                          </Button>
                        ) : (
                          <div className="field-blank flex h-11 items-center rounded-xl border px-3 text-sm text-muted-foreground">
                            Saved row
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {initialValues.readOnlyItems.length > 0 ? (
          <div className="rounded-[1.25rem] border border-border/60 bg-background/40 p-4">
            <p className="text-sm font-medium">Read-only lines</p>
            <p className="mt-2 text-sm text-muted-foreground">
              System-managed backlog adjustments, recurring charges, and linked
              allocations stay read-only here.
            </p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              {initialValues.readOnlyItems.map((item) => (
                <p key={item.id}>
                  {item.itemType.replaceAll("_", " ")} · {item.description} ·{" "}
                  {item.amount}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {state.message ? (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="rounded-full" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Save backlog invoice
        </Button>
      </div>
    </form>
  );
}
