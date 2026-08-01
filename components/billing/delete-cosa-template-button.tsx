"use client";

import { useActionState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import type { CosaTemplateFormState } from "@/app/(dashboard)/billing/actions";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/components/ui/toast-provider";

const initialState: CosaTemplateFormState = {};

type DeleteCosaTemplateButtonProps = {
  action: (
    state: CosaTemplateFormState,
    formData: FormData
  ) => Promise<CosaTemplateFormState>;
  templateName: string;
};

export function DeleteCosaTemplateButton({
  action,
  templateName,
}: DeleteCosaTemplateButtonProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useActionToast({
    message: state.message,
    title: "Template not deleted",
    intent: "error",
  });

  return (
    <form
      action={formAction}
      className="rounded-xl border border-destructive/25 bg-destructive/5 p-5"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Delete ${templateName} permanently?\n\nExisting COSA records and invoices will not be changed. This template will stop appearing when creating future COSA entries.`
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <p className="text-[0.72rem] uppercase tracking-[0.26em] text-destructive/80">
        Permanent delete
      </p>
      <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-foreground">
        Delete this template
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        This permanently removes the reusable template only. Existing monthly COSA
        records and invoices stay unchanged because they already store snapshot
        data.
      </p>

      {state.message ? (
        <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        <Button
          type="submit"
          variant="destructive"
          className="h-11 rounded-xl"
          disabled={pending}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
          Delete template permanently
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Confirmation is required. This action cannot be undone.
        </p>
      </div>
    </form>
  );
}
