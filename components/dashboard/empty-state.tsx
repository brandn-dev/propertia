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
    <div className="rounded-[1.7rem] border border-dashed border-border/80 bg-muted/35 p-6">
      <div className="flex max-w-xl flex-col gap-4">
        <div className="flex size-11 items-center justify-center rounded-[1rem] bg-background/80 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <Icon className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-base font-medium tracking-[-0.03em]">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
