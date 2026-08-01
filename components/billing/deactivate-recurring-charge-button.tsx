"use client";

import { useActionState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import type { RecurringChargeFormState } from "@/app/(dashboard)/billing/actions";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/components/ui/toast-provider";

const initialState: RecurringChargeFormState = {};

type DeactivateRecurringChargeButtonProps = {
  action: (
    state: RecurringChargeFormState,
    formData: FormData
  ) => Promise<RecurringChargeFormState>;
  chargeLabel: string;
  compact?: boolean;
};

export function DeactivateRecurringChargeButton({
  action,
  chargeLabel,
  compact = false,
}: DeactivateRecurringChargeButtonProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useActionToast({
    message: state.message,
    title: "Charge not removed",
    intent: "error",
  });

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Remove ${chargeLabel} from future billing?\n\nThis is a soft delete. Existing invoices stay unchanged. Future cycles will stop including this recurring charge.`
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="destructive"
        size={compact ? "sm" : "lg"}
        className={compact ? "rounded-full" : "h-11 rounded-xl"}
        disabled={pending}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
        {compact ? "Remove" : "Remove from future billing"}
      </Button>
    </form>
  );
}
