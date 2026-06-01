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
    <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-primary shadow-sm">
            <Icon className="size-4.5" />
          </div>
          <div className="min-w-0 text-lg font-semibold tracking-[-0.04em]">
            {label}
          </div>
        </div>

        <div className="my-4 border-t border-dashed border-border/60" />

        <div className="space-y-1">
          <div className="text-[2.15rem] leading-none font-semibold tracking-[-0.07em]">
            {value}
          </div>
          <p className="text-sm leading-5 text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}
