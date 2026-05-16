"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type DeleteReadingButtonProps = {
  action: () => void;
  confirmMessage: string;
  label?: string;
  ariaLabel?: string;
  title?: string;
  size?: "sm" | "icon-sm";
  className?: string;
  iconOnly?: boolean;
};

export function DeleteReadingButton({
  action,
  confirmMessage,
  label = "Delete",
  ariaLabel,
  title,
  size = "sm",
  className,
  iconOnly = false,
}: DeleteReadingButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton
        ariaLabel={ariaLabel ?? label}
        className={className}
        iconOnly={iconOnly}
        label={label}
        size={size}
        title={title ?? label}
      />
    </form>
  );
}

function SubmitButton({
  ariaLabel,
  className,
  iconOnly,
  label,
  size,
  title,
}: {
  ariaLabel: string;
  className?: string;
  iconOnly: boolean;
  label: string;
  size: "sm" | "icon-sm";
  title: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="destructive"
      size={size}
      className={className}
      aria-label={ariaLabel}
      title={title}
      disabled={pending}
    >
      <Trash2 />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Button>
  );
}
