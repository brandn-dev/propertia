import { Building2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_STYLES = {
  sm: {
    wrapper: "gap-2.5",
    mark: "size-10 rounded-full",
    icon: "size-5",
    title: "text-[1.05rem]",
    subtitle: "text-[0.68rem]",
  },
  md: {
    wrapper: "gap-3",
    mark: "size-11 rounded-[1.35rem]",
    icon: "size-5.5",
    title: "text-[1.15rem]",
    subtitle: "text-[0.72rem]",
  },
  lg: {
    wrapper: "gap-4",
    mark: "size-14 rounded-xl",
    icon: "size-7",
    title: "text-[1.65rem]",
    subtitle: "text-[0.76rem]",
  },
} as const;

type PropertiaLogoProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  showWordmark?: boolean;
  size?: keyof typeof SIZE_STYLES;
  subtitle?: string;
};

export function PropertiaLogo({
  className,
  markClassName,
  wordmarkClassName,
  titleClassName,
  subtitleClassName,
  showWordmark = true,
  size = "md",
  subtitle = "Property operations suite",
}: PropertiaLogoProps) {
  const styles = SIZE_STYLES[size];

  return (
    <div className={cn("flex min-w-0 items-center", styles.wrapper, className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#0d698f_0%,#1a8ac0_58%,#38b8c7_100%)] text-white shadow-[0_18px_40px_-24px_rgba(17,96,150,0.8)]",
          styles.mark,
          markClassName
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.3),_transparent_48%)]" />
        <Building2Icon className={cn("relative", styles.icon)} aria-hidden="true" />
      </div>

      {showWordmark ? (
        <div data-wordmark className={cn("min-w-0", wordmarkClassName)}>
          <div
            className={cn(
              "truncate font-semibold tracking-[-0.045em] text-foreground",
              styles.title,
              titleClassName
            )}
          >
            Propertia
          </div>
          <div
            className={cn(
              "truncate uppercase tracking-[0.24em] text-muted-foreground",
              styles.subtitle,
              subtitleClassName
            )}
          >
            {subtitle}
          </div>
        </div>
      ) : null}
    </div>
  );
}
