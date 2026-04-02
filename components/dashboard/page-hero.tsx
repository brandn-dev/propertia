import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardPageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badges?: string[];
  action?: ReactNode;
  className?: string;
};

export function DashboardPageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  badges = [],
  action,
  className,
}: DashboardPageHeroProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[2rem] border-border/70 bg-card/88 shadow-[0_30px_80px_-55px_rgba(15,23,42,0.35)]",
        className
      )}
    >
      <CardContent className="relative p-6 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(67,113,191,0.16),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(56,184,199,0.12),_transparent_36%)]" />

        <div className="relative flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-primary/11 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                <Icon className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-[0.72rem] uppercase tracking-[0.28em] text-muted-foreground">
                  {eyebrow}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em] sm:text-[2.4rem]">
                  {title}
                </h1>
              </div>
            </div>

            {action ? <div className="shrink-0">{action}</div> : null}
          </div>

          <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            {description}
          </p>

          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {badges.map((badge) => (
                <Badge
                  key={badge}
                  variant="outline"
                  className="rounded-full border-border/70 bg-background/72 px-3 py-1 text-[0.72rem] dark:bg-white/5"
                >
                  {badge}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
