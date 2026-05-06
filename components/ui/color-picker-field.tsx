"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ColorPickerFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  errorMessage?: string;
};

export function ColorPickerField({
  id,
  name,
  label,
  value,
  onChange,
  errorMessage,
}: ColorPickerFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="field-blank flex h-11 items-center gap-3 rounded-xl border px-3">
        <input
          id={id}
          name={name}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="size-7 rounded-md border-0 bg-transparent p-0"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-9 border-0 bg-transparent px-0 font-mono uppercase shadow-none focus-visible:ring-0",
            errorMessage ? "text-destructive" : ""
          )}
        />
      </div>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
