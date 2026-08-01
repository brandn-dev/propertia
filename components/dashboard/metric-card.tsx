import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type DashboardMetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function DashboardMetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: DashboardMetricCardProps) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card/95 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[0.7rem] font-semibold tracking-[0.11em] text-muted-foreground uppercase">
              {label}
            </div>
            <div className="mt-2 text-[1.85rem] leading-none font-semibold tracking-[-0.06em] tabular-nums">
              {value}
            </div>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/9 text-primary ring-1 ring-primary/12">
            <Icon className="size-4" />
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
