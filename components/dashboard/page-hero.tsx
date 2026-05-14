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
  title,
  description,
  icon: Icon,
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
        "overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm",
        className
      )}
    >
      <CardContent className={cn("p-5 md:p-6", contentClassName)}>
        <div className="flex flex-col gap-5">
          <div
            className={cn(
              "flex flex-wrap items-start justify-between gap-4",
              headerClassName
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-4.5" />
              </div>

              <div className="min-w-0">
                <h1
                  className={cn(
                    "text-2xl font-semibold tracking-[-0.05em] sm:text-[2rem]",
                    titleClassName
                  )}
                >
                  {title}
                </h1>
              </div>
            </div>

            {action ? (
              <div
                className={cn(
                  "min-w-0 max-w-full basis-full",
                  actionContainerClassName
                )}
              >
                {action}
              </div>
            ) : null}
          </div>

          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
