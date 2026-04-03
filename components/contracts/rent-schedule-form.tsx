"use client";

import { useActionState, useState } from "react";
import { CalendarPlus2, LoaderCircle, Save, Trash2 } from "lucide-react";
import type { RentScheduleFormState } from "@/app/(dashboard)/contracts/actions";
import {
  INCREASE_TYPES,
  INCREASE_TYPE_LABELS,
  RENT_BASE_OPTIONS,
  RENT_BASE_OPTION_LABELS,
} from "@/lib/form-options";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RentScheduleFormState = {};

type RentScheduleFormProps = {
  formAction: (
    state: RentScheduleFormState,
    formData: FormData
  ) => Promise<RentScheduleFormState>;
  contractStartDateLabel: string;
  initialRows: {
    kind: "BASE" | "ADJUSTMENT";
    effectiveDate: string;
    monthlyRent?: string;
    increaseType?: (typeof INCREASE_TYPES)[number];
    increaseValue?: string;
    basedOn?: (typeof RENT_BASE_OPTIONS)[number];
  }[];
};

type BaseScheduleRow = {
  id: string;
  kind: "BASE";
  effectiveDate: string;
  monthlyRent: string;
};

type AdjustmentScheduleRow = {
  id: string;
  kind: "ADJUSTMENT";
  effectiveDate: string;
  increaseType: (typeof INCREASE_TYPES)[number];
  increaseValue: string;
  basedOn: (typeof RENT_BASE_OPTIONS)[number];
};

type ScheduleRow = BaseScheduleRow | AdjustmentScheduleRow;

const selectClassName =
  "select-blank";

function createStableInitialRowId(index: number) {
  return `schedule-row-${index}`;
}

function createClientRowId(sequence: number) {
  return `schedule-row-client-${sequence}`;
}

function addOneYear(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function RentScheduleForm({
  formAction,
  contractStartDateLabel,
  initialRows,
}: RentScheduleFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [rows, setRows] = useState<ScheduleRow[]>(
    initialRows.map((row, index) => ({
      id: createStableInitialRowId(index),
      ...row,
    })) as ScheduleRow[]
  );
  const [nextClientRowIndex, setNextClientRowIndex] = useState(initialRows.length);

  function updateBaseRow(
    rowId: string,
    updates: Partial<Pick<BaseScheduleRow, "effectiveDate" | "monthlyRent">>
  ) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId && row.kind === "BASE"
          ? {
              ...row,
              ...updates,
            }
          : row
      )
    );
  }

  function updateAdjustmentRow(
    rowId: string,
    updates: Partial<
      Pick<
        AdjustmentScheduleRow,
        "effectiveDate" | "increaseType" | "increaseValue" | "basedOn"
      >
    >
  ) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId && row.kind === "ADJUSTMENT"
          ? {
              ...row,
              ...updates,
            }
          : row
      )
    );
  }

  function addRow() {
    const nextRowId = createClientRowId(nextClientRowIndex);

    setRows((currentRows) => {
      const lastRow = currentRows[currentRows.length - 1];

      return [
        ...currentRows,
        {
          id: nextRowId,
          kind: "ADJUSTMENT",
          effectiveDate: addOneYear(lastRow?.effectiveDate ?? ""),
          increaseType: "PERCENTAGE",
          increaseValue: "",
          basedOn: "PREVIOUS_RENT",
        },
      ];
    });
    setNextClientRowIndex((currentValue) => currentValue + 1);
  }

  function removeRow(rowId: string) {
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  }

  const rowsWithPreview = rows.reduce<
    Array<
      | (BaseScheduleRow & { previewMonthlyRent: number })
      | (AdjustmentScheduleRow & {
          previewMonthlyRent: number;
          referenceRent: number;
        })
    >
  >((accumulator, row) => {
    if (row.kind === "BASE") {
      const baseRent = Number(row.monthlyRent || 0);

      return [
        ...accumulator,
        {
          ...row,
          previewMonthlyRent: baseRent,
        },
      ];
    }

    const baseRow = accumulator[0];
    const previousRow = accumulator[accumulator.length - 1];
    const baseRent = baseRow?.previewMonthlyRent ?? 0;
    const runningRent = previousRow?.previewMonthlyRent ?? baseRent;
    const increaseValue = Number(row.increaseValue || 0);
    const referenceRent = row.basedOn === "BASE_RENT" ? baseRent : runningRent;
    const increaseAmount =
      row.increaseType === "FIXED"
        ? increaseValue
        : referenceRent * (increaseValue / 100);
    const previewMonthlyRent = Number((runningRent + increaseAmount).toFixed(2));

    return [
      ...accumulator,
      {
        ...row,
        previewMonthlyRent,
        referenceRent,
      },
    ];
  }, []);

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="scheduleRows"
        value={JSON.stringify(
          rows.map((row) =>
            row.kind === "BASE"
              ? {
                  kind: row.kind,
                  effectiveDate: row.effectiveDate,
                  monthlyRent: row.monthlyRent,
                }
              : {
                  kind: row.kind,
                  effectiveDate: row.effectiveDate,
                  increaseType: row.increaseType,
                  increaseValue: row.increaseValue,
                  basedOn: row.basedOn,
                }
          )
        )}
      />

      <div className="border-blank space-y-5 rounded-xl p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-[-0.04em]">
              Rent schedule
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              The first row is always the contract start date and base rent. Add
              as many future effectivity dates as needed, then choose fixed or
              percentage adjustments with a live resulting-rent preview.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="button-blank rounded-full"
            onClick={addRow}
          >
            <CalendarPlus2 />
            Add effectivity
          </Button>
        </div>

        <div className="space-y-4">
          {rowsWithPreview.map((row, index) => (
            <div
              key={row.id}
              className="grid gap-3 rounded-xl border border-border/60 bg-background/55 p-4 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
            >
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Schedule row
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {index === 0 ? "Start rate" : `Adjustment ${index}`}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`effectiveDate-${row.id}`}>Effectivity date</Label>
                <Input
                  id={`effectiveDate-${row.id}`}
                  type="date"
                  value={row.effectiveDate}
                  disabled={index === 0}
                  onChange={(event) =>
                    row.kind === "BASE"
                      ? updateBaseRow(row.id, { effectiveDate: event.target.value })
                      : updateAdjustmentRow(row.id, {
                          effectiveDate: event.target.value,
                        })
                  }
                  className="field-blank h-11"
                />
                {index === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Locked to contract start date: {contractStartDateLabel}
                  </p>
                ) : null}
              </div>

              {row.kind === "BASE" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`monthlyRent-${row.id}`}>Monthly rent</Label>
                    <Input
                      id={`monthlyRent-${row.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.monthlyRent}
                      onChange={(event) =>
                        updateBaseRow(row.id, {
                          monthlyRent: event.target.value,
                        })
                      }
                      className="field-blank h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="field-blank flex h-11 items-center rounded-lg px-3 text-sm font-medium">
                      {formatCurrency(row.previewMonthlyRent || 0)}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`increaseType-${row.id}`}>Adjustment</Label>
                    <select
                      id={`increaseType-${row.id}`}
                      value={row.increaseType}
                      onChange={(event) =>
                        updateAdjustmentRow(row.id, {
                          increaseType: event.target.value as AdjustmentScheduleRow["increaseType"],
                        })
                      }
                      className={selectClassName}
                    >
                      {INCREASE_TYPES.map((increaseType) => (
                        <option key={increaseType} value={increaseType}>
                          {INCREASE_TYPE_LABELS[increaseType]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`increaseValue-${row.id}`}>
                      {row.increaseType === "PERCENTAGE"
                        ? "Increase (%)"
                        : "Increase amount"}
                    </Label>
                    <Input
                      id={`increaseValue-${row.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.increaseValue}
                      onChange={(event) =>
                        updateAdjustmentRow(row.id, {
                          increaseValue: event.target.value,
                        })
                      }
                      placeholder={row.increaseType === "PERCENTAGE" ? "10" : "1500"}
                      className="field-blank h-11"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`basedOn-${row.id}`}>Based on</Label>
                    <select
                      id={`basedOn-${row.id}`}
                      value={row.basedOn}
                      onChange={(event) =>
                        updateAdjustmentRow(row.id, {
                          basedOn: event.target.value as AdjustmentScheduleRow["basedOn"],
                        })
                      }
                      className={selectClassName}
                    >
                      {RENT_BASE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {RENT_BASE_OPTION_LABELS[option]}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Preview:{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(row.previewMonthlyRent || 0)}
                      </span>
                      {" · "}
                      from {formatCurrency(row.referenceRent || 0)}
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end">
                {index > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="button-blank rounded-full"
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <FieldError message={state.errors?.scheduleRows?.[0]} />

        {state.message ? (
          <div className="rounded-xl border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
            {state.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" className="rounded-full" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
            Save rent schedule
          </Button>
        </div>
      </div>
    </form>
  );
}
