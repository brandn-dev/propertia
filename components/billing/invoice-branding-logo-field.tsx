"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type InvoiceBrandingLogoFieldProps = {
  initialLogoUrl?: string;
  errorMessage?: string;
  onPreviewUrlChange?: (nextUrl: string) => void;
};

export function InvoiceBrandingLogoField({
  initialLogoUrl,
  errorMessage,
  onPreviewUrlChange,
}: InvoiceBrandingLogoFieldProps) {
  const [previewUrl, setPreviewUrl] = useState(initialLogoUrl ?? "");
  const [removeLogo, setRemoveLogo] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setRemoveLogo(false);
    onPreviewUrlChange?.(nextPreviewUrl);
  }

  function handleRemoveLogo() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setPreviewUrl("");
    setRemoveLogo(true);
    onPreviewUrlChange?.("");
  }

  return (
    <section className="border-blank rounded-xl p-5">
      <div className="space-y-1">
        <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
          Template branding
        </p>
        <h2 className="text-lg font-semibold tracking-[-0.04em]">
          Invoice template logo
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Optional PNG mark for this template. When empty, template can still
          fall back to each property logo.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[112px_minmax(0,1fr)]">
        <div className="border-blank flex aspect-square w-28 items-center justify-center overflow-hidden rounded-[1.2rem] border bg-muted/35">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Invoice template logo preview"
              className="h-full w-full object-contain p-3"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center text-xs text-muted-foreground">
              <ImageUp className="size-5" aria-hidden="true" />
              <span>No template logo</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <input
            type="hidden"
            name="removeLogo"
            value={removeLogo ? "true" : "false"}
          />

          <div className="space-y-2">
            <Label htmlFor="logoFile">Template logo PNG</Label>
            <input
              ref={inputRef}
              id="logoFile"
              name="logoFile"
              type="file"
              accept="image/png"
              onChange={handleFileChange}
              className={cn("field-blank h-11 w-full", errorMessage ? "border-destructive" : "")}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              PNG only. Max 2 MB. Stored in Vercel Blob.
            </p>
            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}
          </div>

          {previewUrl ? (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove logo
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
