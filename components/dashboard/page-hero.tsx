import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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
    <header
      className={cn(
        "border-b border-border/70 pb-5",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
          contentClassName,
          headerClassName
        )}
      >
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <div className="mb-2 flex items-center gap-2 text-[0.68rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
              <Icon aria-hidden="true" className="size-3.5 text-primary" />
              <span>{eyebrow}</span>
            </div>
          ) : (
            <Icon aria-hidden="true" className="mb-2 size-4 text-primary" />
          )}
          <h1
            className={cn(
              "text-2xl font-semibold tracking-[-0.045em] sm:text-[1.9rem]",
              titleClassName
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
          {badges && badges.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
                >
                  <span aria-hidden="true" className="size-1 rounded-full bg-border" />
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {action ? (
          <div
            className={cn(
              "min-w-0 max-w-full shrink-0",
              actionContainerClassName
            )}
          >
            {action}
          </div>
        ) : null}
      </div>
    </header>
  );
}
