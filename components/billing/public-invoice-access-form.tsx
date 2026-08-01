"use client";

import { useActionState } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import type { PublicInvoiceAccessFormState } from "@/lib/validations/public-invoice-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PublicInvoiceAccessFormProps = {
  invoiceNumber: string;
  action: (
    state: PublicInvoiceAccessFormState,
    formData: FormData
  ) => Promise<PublicInvoiceAccessFormState>;
};

export function PublicInvoiceAccessForm({
  invoiceNumber,
  action,
}: PublicInvoiceAccessFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
        This invoice is publicly visitable, but it requires the invoice password before
        details are shown.
      </div>

      <div className="space-y-2">
        <Label htmlFor="accessCode">Invoice password</Label>
        <Input
          id="accessCode"
          name="accessCode"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          placeholder="A1B2C3"
          maxLength={6}
          className="h-11 border-border/60 bg-background/80 font-mono text-base tracking-[0.2em] uppercase"
        />
        {state?.errors?.accessCode ? (
          <p className="text-sm text-destructive">{state.errors.accessCode[0]}</p>
        ) : null}
      </div>

      {state?.message ? (
        <div className="rounded-xl border border-border/60 bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          {state.message}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full rounded-xl shadow-sm"
        disabled={pending}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}
        Unlock {invoiceNumber}
      </Button>
    </form>
  );
}
