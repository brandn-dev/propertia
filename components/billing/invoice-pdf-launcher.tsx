import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_INVOICE_PAPER_SIZE,
  INVOICE_PAPER_SIZE_OPTIONS,
} from "@/lib/billing/invoice-pdf-options";
import { cn } from "@/lib/utils";

type InvoicePdfLauncherProps = {
  action: string;
  className?: string;
  theme?: "default" | "inverse";
  buttonMode?: "default" | "icon";
};

export function InvoicePdfLauncher({
  action,
  className,
  theme = "default",
  buttonMode = "default",
}: InvoicePdfLauncherProps) {
  const inverse = theme === "inverse";
  const iconOnly = buttonMode === "icon";
  const inputId = `paper-size-${theme}-${action.replace(/[^a-z0-9]+/gi, "-")}`;

  return (
    <form
      action={action}
      method="get"
      target="_blank"
      className={cn(
        "flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap",
        className
      )}
    >
      <label className="sr-only" htmlFor={inputId}>
        Paper size
      </label>
      <select
        id={inputId}
        name="paper"
        defaultValue={DEFAULT_INVOICE_PAPER_SIZE}
        className={cn(
          "select-blank h-9 min-w-0 flex-1 rounded-full border px-4 pr-12 text-sm sm:min-w-[8.5rem] md:min-w-[11rem]",
          inverse
            ? "select-blank-inverse border-slate-700 bg-slate-900 text-slate-100"
            : "border-border/60 bg-background text-foreground"
        )}
      >
        {INVOICE_PAPER_SIZE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        variant="outline"
        className={cn(
          "shrink-0 rounded-full",
          iconOnly && "px-3",
          inverse
            ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            : "button-blank"
        )}
      >
        <FileText />
        {iconOnly ? <span className="sr-only">Open PDF</span> : "Open PDF"}
      </Button>
    </form>
  );
}
