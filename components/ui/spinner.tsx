"use client";

import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  label?: string;
};

export function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      aria-label={label}
      aria-live="polite"
      role="status"
    >
      <LoaderCircle className="animate-spin" />
    </span>
  );
}
