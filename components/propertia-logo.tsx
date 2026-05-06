import type { CSSProperties } from "react";
import { Building2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_STYLES = {
  sm: {
    markSize: 40,
    wrapper: "gap-2.5",
    mark: "size-10 rounded-full",
    icon: "size-5",
    title: "text-[1.05rem]",
    subtitle: "text-[0.68rem]",
  },
  md: {
    markSize: 44,
    wrapper: "gap-3",
    mark: "size-11 rounded-[1.35rem]",
    icon: "size-5.5",
    title: "text-[1.15rem]",
    subtitle: "text-[0.72rem]",
  },
  lg: {
    markSize: 56,
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
  title?: string;
  subtitle?: string;
  logoSrc?: string | null;
  logoAlt?: string;
  logoScale?: number;
  titleStyle?: CSSProperties;
  subtitleStyle?: CSSProperties;
  plainMark?: boolean;
};

export function PropertiaLogo({
  className,
  markClassName,
  wordmarkClassName,
  titleClassName,
  subtitleClassName,
  showWordmark = true,
  size = "md",
  title = "Propertia",
  subtitle = "Property operations suite",
  logoSrc,
  logoAlt = "Property logo",
  logoScale = 100,
  titleStyle,
  subtitleStyle,
  plainMark = false,
}: PropertiaLogoProps) {
  const styles = SIZE_STYLES[size];
  const markStyle = {
    width: `${(styles.markSize * logoScale) / 100}px`,
    height: `${(styles.markSize * logoScale) / 100}px`,
  } satisfies CSSProperties;

  return (
    <div className={cn("flex min-w-0 items-center", styles.wrapper, className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center text-white",
          logoSrc
            ? "overflow-visible rounded-none bg-transparent shadow-none ring-0"
            : cn(
                "overflow-hidden bg-[linear-gradient(145deg,#0d698f_0%,#1a8ac0_58%,#38b8c7_100%)] shadow-[0_18px_40px_-24px_rgba(17,96,150,0.8)]",
                plainMark ? "bg-transparent shadow-none ring-0" : "",
                styles.mark
              ),
          markClassName
        )}
        style={markStyle}
      >
        {logoSrc ? (
          // Blob URLs and local uploaded asset paths should work without remote image config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={logoAlt}
            className="relative h-full w-full object-contain"
          />
        ) : (
          <>
            {!plainMark ? (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.3),_transparent_48%)]" />
            ) : null}
            <Building2Icon className={cn("relative", styles.icon)} aria-hidden="true" />
          </>
        )}
      </div>

      {showWordmark ? (
        <div data-wordmark className={cn("min-w-0", wordmarkClassName)}>
          <div
            className={cn(
              "truncate font-semibold tracking-[-0.045em] text-foreground",
              styles.title,
              titleClassName
            )}
            style={titleStyle}
          >
            {title}
          </div>
          <div
            className={cn(
              "truncate uppercase tracking-[0.24em] text-muted-foreground",
              styles.subtitle,
              subtitleClassName
            )}
            style={subtitleStyle}
          >
            {subtitle}
          </div>
        </div>
      ) : null}
    </div>
  );
}
