import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardPageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  badges?: string[];
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  actionContainerClassName?: string;
  titleClassName?: string;
};

export function DashboardPageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  badges,
  action,
  className,
  contentClassName,
  headerClassName,
  actionContainerClassName,
  titleClassName,
}: DashboardPageHeroProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-border/60 bg-card/95 shadow-sm",
        className
      )}
    >
      <CardContent className={cn("p-4 md:p-5", contentClassName)}>
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "flex flex-wrap items-start justify-between gap-4",
              headerClassName
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-primary shadow-sm">
                <Icon className="size-4.5" />
              </div>

              <div className="min-w-0">
                {eyebrow ? (
                  <div className="mb-1 text-[0.68rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                    {eyebrow}
                  </div>
                ) : null}
                <h1
                  className={cn(
                    "text-2xl font-semibold tracking-[-0.05em] sm:text-[2rem]",
                    titleClassName
                  )}
                >
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                    {description}
                  </p>
                ) : null}
                {badges && badges.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[0.68rem] font-medium tracking-[0.14em] text-muted-foreground uppercase"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {action ? (
              <div
                className={cn(
                  "min-w-0 max-w-full",
                  actionContainerClassName
                )}
              >
                {action}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
