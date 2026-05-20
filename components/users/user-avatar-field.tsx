"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type UserAvatarFieldProps = {
  initialAvatarUrl?: string;
  previewName: string;
  errorMessage?: string;
  onPreviewUrlChange?: (nextUrl: string) => void;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserAvatarField({
  initialAvatarUrl,
  previewName,
  errorMessage,
  onPreviewUrlChange,
}: UserAvatarFieldProps) {
  const [previewUrl, setPreviewUrl] = useState(initialAvatarUrl ?? "");
  const [removeAvatar, setRemoveAvatar] = useState(false);
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
    setRemoveAvatar(false);
    onPreviewUrlChange?.(nextPreviewUrl);
  }

  function handleRemoveAvatar() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setPreviewUrl("");
    setRemoveAvatar(true);
    onPreviewUrlChange?.("");
  }

  return (
    <section className="border-blank rounded-xl p-5">
      <div className="space-y-1">
        <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
          Profile
        </p>
        <h2 className="text-lg font-semibold tracking-[-0.04em]">Profile photo</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Optional PNG avatar stored in Vercel Blob.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[112px_minmax(0,1fr)]">
        <div className="flex aspect-square w-28 items-center justify-center overflow-hidden rounded-[1.2rem] border border-border/60 bg-muted/35">
          <Avatar size="lg" className="size-24">
            {previewUrl ? <AvatarImage src={previewUrl} alt={`${previewName} avatar`} /> : null}
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xl">
              {getInitials(previewName || "User")}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="space-y-3">
          <input
            type="hidden"
            name="removeAvatar"
            value={removeAvatar ? "true" : "false"}
          />

          <div className="space-y-2">
            <Label htmlFor="avatarFile">Avatar PNG</Label>
            <input
              ref={inputRef}
              id="avatarFile"
              name="avatarFile"
              type="file"
              accept="image/png"
              onChange={handleFileChange}
              className={cn("field-blank h-11 w-full", errorMessage ? "border-destructive" : "")}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              PNG only. Max 2 MB.
            </p>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </div>

          {previewUrl ? (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove avatar
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ImageUp className="size-4" aria-hidden="true" />
              Upload if you want a profile image instead of initials.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
