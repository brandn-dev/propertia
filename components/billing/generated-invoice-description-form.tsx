"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import type { GeneratedInvoiceDescriptionFormState } from "@/app/(dashboard)/billing/[invoiceId]/edit/actions";
import {
  INVOICE_ITEM_DESCRIPTION_MODE_LABELS,
  INVOICE_ITEM_DESCRIPTION_MODES,
} from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionRedirect } from "@/components/ui/use-action-redirect";
import { useActionToast } from "@/components/ui/toast-provider";

const initialState: GeneratedInvoiceDescriptionFormState = {};
const selectClassName = "select-blank";

type DescriptionItem = {
  id: string;
  itemType: string;
  typeLabel: string;
  currentDescription: string;
  descriptionMode: (typeof INVOICE_ITEM_DESCRIPTION_MODES)[number];
  customDescription: string;
  supportsDateVisibilityOverride: boolean;
};

type GeneratedInvoiceDescriptionFormProps = {
  invoiceId: string;
  formAction: (
    state: GeneratedInvoiceDescriptionFormState,
    formData: FormData
  ) => Promise<GeneratedInvoiceDescriptionFormState>;
  initialValues: {
    items: DescriptionItem[];
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function GeneratedInvoiceDescriptionForm({
  invoiceId,
  formAction,
  initialValues,
}: GeneratedInvoiceDescriptionFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  useActionRedirect(state.redirectTo);
  useActionToast({
    message: state.message,
    title: "Description changes not saved",
    intent: "error",
  });
  const [items, setItems] = useState(initialValues.items);

  function updateItem(
    itemId: string,
    changes: Partial<Pick<DescriptionItem, "descriptionMode" | "customDescription">>
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...changes,
            }
          : item
      )
    );
  }

  const serializedOverrides = JSON.stringify(
    items.map((item) => ({
      id: item.id,
      descriptionMode: item.descriptionMode,
      customDescription: item.customDescription,
    }))
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="invoiceId" value={invoiceId} readOnly />
      <input
        type="hidden"
        name="descriptionOverrides"
        value={serializedOverrides}
        readOnly
      />

      <div className="border-blank space-y-6 rounded-xl p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-[-0.04em]">
            Invoice line descriptions
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Change how each line appears on this invoice only. Rent and recurring
            charge rows can show dates, hide dates, or use custom wording.
          </p>
          <FieldError message={state.errors?.descriptionOverrides?.[0]} />
        </div>

        <div className="space-y-4">
          {items.map((item) => {
            const modeOptions = item.supportsDateVisibilityOverride
              ? INVOICE_ITEM_DESCRIPTION_MODES
              : INVOICE_ITEM_DESCRIPTION_MODES.filter(
                  (mode) => mode === "AUTO" || mode === "CUSTOM"
                );

            return (
              <div
                key={item.id}
                className="rounded-[1.35rem] border border-border/60 bg-background/70 p-4"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <p className="text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground">
                      {item.typeLabel}
                    </p>
                    <p className="text-sm font-medium leading-6">
                      {item.currentDescription}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.supportsDateVisibilityOverride
                        ? "This row supports tenant default, show dates, hide dates, or custom text."
                        : "This row supports default behavior or custom text."}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`description-mode-${item.id}`}>
                        Description mode
                      </Label>
                      <select
                        id={`description-mode-${item.id}`}
                        value={item.descriptionMode}
                        onChange={(event) =>
                          updateItem(item.id, {
                            descriptionMode: event.target
                              .value as DescriptionItem["descriptionMode"],
                          })
                        }
                        className={selectClassName}
                      >
                        {modeOptions.map((mode) => (
                          <option key={mode} value={mode}>
                            {INVOICE_ITEM_DESCRIPTION_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {item.descriptionMode === "CUSTOM" ? (
                      <div className="space-y-2">
                        <Label htmlFor={`custom-description-${item.id}`}>
                          Custom description
                        </Label>
                        <Textarea
                          id={`custom-description-${item.id}`}
                          value={item.customDescription}
                          onChange={(event) =>
                            updateItem(item.id, {
                              customDescription: event.target.value,
                            })
                          }
                          placeholder="Enter custom line description"
                          className="field-blank min-h-24"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="lg" className="h-11 rounded-xl" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
            Save description changes
          </Button>
        </div>
      </div>
    </form>
  );
}
