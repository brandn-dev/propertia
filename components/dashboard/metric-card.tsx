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
    <Card className="rounded-xl border-border/60 bg-card shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-1.5">
          <CardDescription>{label}</CardDescription>
          <div className="text-2xl font-semibold tracking-[-0.04em]">{value}</div>
          <p className="text-sm leading-5 text-muted-foreground">{detail}</p>
        </div>

        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}
