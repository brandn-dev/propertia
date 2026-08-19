"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useRef, useState } from "react";
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
  autoFitTitle?: boolean;
  autoFitKey?: string;
  showTitle?: boolean;
  showSubtitle?: boolean;
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
  autoFitTitle = false,
  autoFitKey,
  showTitle = true,
  showSubtitle = true,
}: PropertiaLogoProps) {
  const styles = SIZE_STYLES[size];
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [titleFit, setTitleFit] = useState({ scale: 1, wraps: false });
  const markStyle = {
    width: `${(styles.markSize * logoScale) / 100}px`,
    height: `${(styles.markSize * logoScale) / 100}px`,
  } satisfies CSSProperties;

  useLayoutEffect(() => {
    if (!autoFitTitle) {
      return;
    }

    const wordmark = wordmarkRef.current;
    const titleElement = titleRef.current;

    if (!wordmark || !titleElement) {
      return;
    }

    let cancelled = false;
    let frame = 0;

    const fitTitle = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        const previousWhiteSpace = titleElement.style.whiteSpace;
        titleElement.style.whiteSpace = "nowrap";

        const naturalWidth =
          titleElement.scrollWidth / Math.max(titleFit.scale, 0.6);
        const availableWidth = wordmark.clientWidth;
        const ratio =
          naturalWidth > 0 && availableWidth > 0
            ? availableWidth / naturalWidth
            : 1;
        const scale = Math.min(1, Math.max(0.6, ratio));
        const wraps = ratio < 0.6;

        titleElement.style.whiteSpace = previousWhiteSpace;

        setTitleFit((current) =>
          current.scale === scale && current.wraps === wraps
            ? current
            : { scale, wraps }
        );
      });
    };

    const observer = new ResizeObserver(fitTitle);
    observer.observe(wordmark);
    fitTitle();
    void document.fonts?.ready.then(fitTitle);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [
    autoFitKey,
    autoFitTitle,
    showTitle,
    title,
    titleFit.scale,
    titleStyle?.fontSize,
  ]);

  const fittedTitleStyle = autoFitTitle
    ? {
        ...titleStyle,
        fontSize: `calc(${typeof titleStyle?.fontSize === "number" ? `${titleStyle.fontSize}px` : titleStyle?.fontSize ?? "1em"} * ${titleFit.scale})`,
      }
    : titleStyle;

  return (
    <div className={cn("flex min-w-0 items-center", styles.wrapper, className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center text-white",
          logoSrc
            ? "overflow-visible rounded-none bg-transparent shadow-none ring-0"
            : cn(
                "overflow-hidden bg-[linear-gradient(145deg,var(--brand-gradient-start)_0%,var(--brand-gradient-middle)_58%,var(--brand-gradient-end)_100%)] shadow-lg shadow-primary/15",
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
        <div ref={wordmarkRef} data-wordmark className={cn("min-w-0", wordmarkClassName)}>
          {showTitle ? <div
            ref={titleRef}
            className={cn(
              autoFitTitle && titleFit.wraps
                ? "overflow-visible whitespace-normal break-words"
                : "truncate",
              "font-semibold tracking-[-0.045em] text-foreground",
              styles.title,
              titleClassName
            )}
            style={fittedTitleStyle}
          >
            {title}
          </div> : null}
          {showSubtitle ? <div
            className={cn(
              "truncate uppercase tracking-[0.24em] text-muted-foreground",
              styles.subtitle,
              subtitleClassName
            )}
            style={subtitleStyle}
          >
            {subtitle}
          </div> : null}
        </div>
      ) : null}
    </div>
  );
}
