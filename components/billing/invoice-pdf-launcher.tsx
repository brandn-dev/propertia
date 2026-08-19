import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_INVOICE_PAPER_SIZE } from "@/lib/billing/invoice-pdf-options";
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
      <input type="hidden" name="paper" value={DEFAULT_INVOICE_PAPER_SIZE} />
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
