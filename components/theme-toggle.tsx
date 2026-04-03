"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;
  const nextTheme = isDark ? "light" : "dark";

  return (
    <Button
      type="button"
      onClick={() => setTheme(nextTheme)}
      variant="outline"
      size="icon-sm"
      className={cn(className)}
      aria-label={mounted ? `Switch to ${nextTheme} mode` : "Toggle theme"}
      role="switch"
      aria-checked={isDark}
      title={mounted ? `Switch to ${nextTheme} mode` : "Toggle theme"}
    >
      <span className="relative flex h-5 w-9 shrink-0 items-center rounded-full border border-border/60 bg-background/65 px-0.5 transition-colors">
        <span
          className={cn(
            "flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform",
            isDark ? "translate-x-4" : "translate-x-0"
          )}
        >
          {isDark ? <MoonStar className="size-3" /> : <SunMedium className="size-3" />}
        </span>
      </span>
      <span className="sr-only">
        {mounted ? `Switch to ${nextTheme} mode` : "Toggle theme"}
      </span>
    </Button>
  );
}
