"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import type { RentAdjustmentFormState } from "@/app/(dashboard)/contracts/actions";
import {
  INCREASE_TYPES,
  INCREASE_TYPE_LABELS,
  RENT_BASE_OPTIONS,
  RENT_BASE_OPTION_LABELS,
  RENT_CALCULATION_TYPES,
  RENT_CALCULATION_TYPE_LABELS,
} from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClassName =
  "select-blank";

const initialState: RentAdjustmentFormState = {};

type RentAdjustmentFormProps = {
  mode: "create" | "edit";
  contractId: string;
  formAction: (
    state: RentAdjustmentFormState,
    formData: FormData
  ) => Promise<RentAdjustmentFormState>;
  initialValues?: {
    effectiveDate: string;
    increaseType: (typeof INCREASE_TYPES)[number];
    increaseValue: string;
    calculationType: (typeof RENT_CALCULATION_TYPES)[number];
    basedOn: (typeof RENT_BASE_OPTIONS)[number];
    notes: string;
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function RentAdjustmentForm({
  mode,
  contractId,
  formAction,
  initialValues = {
    effectiveDate: "",
    increaseType: "PERCENTAGE",
    increaseValue: "",
    calculationType: "COMPOUND",
    basedOn: "PREVIOUS_RENT",
    notes: "",
  },
}: RentAdjustmentFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-xl p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">Effective date</Label>
              <Input
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                defaultValue={initialValues.effectiveDate}
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.effectiveDate?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="increaseType">Increase type</Label>
              <select
                id="increaseType"
                name="increaseType"
                defaultValue={initialValues.increaseType}
                className={selectClassName}
              >
                {INCREASE_TYPES.map((increaseType) => (
                  <option key={increaseType} value={increaseType}>
                    {INCREASE_TYPE_LABELS[increaseType]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.increaseType?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="increaseValue">Increase value</Label>
              <Input
                id="increaseValue"
                name="increaseValue"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.increaseValue}
                placeholder="10 or 1500"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.increaseValue?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calculationType">Calculation type</Label>
              <select
                id="calculationType"
                name="calculationType"
                defaultValue={initialValues.calculationType}
                className={selectClassName}
              >
                {RENT_CALCULATION_TYPES.map((calculationType) => (
                  <option key={calculationType} value={calculationType}>
                    {RENT_CALCULATION_TYPE_LABELS[calculationType]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.calculationType?.[0]} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="basedOn">Based on</Label>
              <select
                id="basedOn"
                name="basedOn"
                defaultValue={initialValues.basedOn}
                className={selectClassName}
              >
                {RENT_BASE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {RENT_BASE_OPTION_LABELS[option]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.basedOn?.[0]} />
              <p className="text-sm text-muted-foreground">
                Example: set the effective date two years after the contract start
                if the rent should increase after 2 years.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={initialValues.notes}
                placeholder="Annual escalation after year two"
                className="field-blank min-h-[120px]"
              />
              <FieldError message={state.errors?.notes?.[0]} />
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
              {mode === "create" ? "New adjustment" : "Update adjustment"}
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {mode === "create" ? "Create rent adjustment" : "Save adjustment"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "create"
                ? "Schedule a future rent increase so invoice generation automatically applies the correct rent once that cycle starts."
                : "Update this scheduled rent change. Future invoice runs will use the revised rule."}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                {mode === "create" ? "Create adjustment" : "Save changes"}
              </Button>
              <Button
                render={<Link href={`/contracts/${contractId}/adjustments`} />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to adjustments
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
