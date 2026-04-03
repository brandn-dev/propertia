import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type DashboardEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: DashboardEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/25 p-5">
      <div className="flex max-w-xl flex-col gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-background text-primary">
          <Icon className="size-4.5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-medium tracking-[-0.03em]">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
