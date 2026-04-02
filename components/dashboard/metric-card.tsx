import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription } from "@/components/ui/card";

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
    <Card className="rounded-[1.65rem] border-border/70 bg-card/92 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <CardDescription>{label}</CardDescription>
          <div className="text-3xl font-semibold tracking-[-0.045em]">{value}</div>
          <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>

        <div className="flex size-11 shrink-0 items-center justify-center rounded-[1.1rem] bg-primary/11 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
