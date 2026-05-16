"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useActionRedirect(redirectTo?: string) {
  const router = useRouter();

  useEffect(() => {
    if (!redirectTo) {
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }, [redirectTo, router]);
}
