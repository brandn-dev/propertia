"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useActionRedirect(redirectTo?: string) {
  const router = useRouter();
  const lastRedirectRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!redirectTo) {
      return;
    }

    if (lastRedirectRef.current === redirectTo) {
      return;
    }

    lastRedirectRef.current = redirectTo;
    router.replace(redirectTo);
  }, [redirectTo, router]);
}
