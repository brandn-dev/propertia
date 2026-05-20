"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("Chart components must be used inside <ChartContainer />");
  }

  return context;
}

export function ChartContainer({
  config,
  className,
  children,
}: React.ComponentProps<"div"> & { config: ChartConfig }) {
  const style = React.useMemo(() => {
    return Object.fromEntries(
      Object.entries(config)
        .filter(([, value]) => value.color)
        .map(([key, value]) => [`--color-${key}`, value.color])
    ) as React.CSSProperties;
  }, [config]);

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        className={cn(
          "h-full min-h-0 w-full min-w-0 text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground/80 [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border/60",
          className
        )}
        style={style}
      >
        {children}
      </div>
    </ChartContext.Provider>
  );
}

export function ChartResponsiveContainer({
  className,
  children,
}: React.ComponentProps<"div">) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const node = containerRef.current;

    if (!node) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.floor(node.clientWidth);
      const nextHeight = Math.floor(node.clientHeight);

      setSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("h-full min-h-0 w-full min-w-0", className)}
    >
      {size.width > 0 && size.height > 0 ? (
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      ) : null}
    </div>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

type ChartTooltipContentProps = Partial<
  RechartsPrimitive.TooltipContentProps<number, string>
> & {
  hideLabel?: boolean;
  valueFormatter?: (value: number, key: string) => React.ReactNode;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  valueFormatter,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="min-w-[180px] rounded-xl border border-border/70 bg-popover/95 px-3 py-2.5 text-xs shadow-2xl backdrop-blur">
      {!hideLabel ? (
        <div className="mb-2 text-[0.7rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {label}
        </div>
      ) : null}

      <div className="space-y-1.5">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? entry.name ?? "value");
          const definition = config[key];
          const rawValue = typeof entry.value === "number" ? entry.value : 0;

          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      entry.color || definition?.color || "currentColor",
                  }}
                />
                <span className="truncate">{definition?.label ?? entry.name ?? key}</span>
              </div>
              <span className="font-medium text-foreground">
                {valueFormatter ? valueFormatter(rawValue, key) : rawValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
