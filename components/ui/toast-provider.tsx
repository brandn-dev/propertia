"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  TOAST_INTENT_QUERY_PARAM,
  TOAST_QUERY_PARAM,
  TOAST_TITLE_QUERY_PARAM,
  type ToastIntent,
} from "@/lib/toast";
import { cn } from "@/lib/utils";

type ToastRecord = {
  id: string;
  intent: ToastIntent;
  title: string;
  description: string;
  exiting?: boolean;
};

type ToastContextValue = {
  showToast: (toast: {
    title?: string;
    description: string;
    intent?: ToastIntent;
  }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_TITLES: Record<ToastIntent, string> = {
  success: "Done",
  error: "Something went wrong",
  info: "Heads up",
};

const TOAST_STYLES: Record<ToastIntent, string> = {
  success:
    "border-success/25 bg-success/10 text-success-foreground",
  error:
    "border-destructive/25 bg-destructive/10 text-destructive",
  info:
    "border-info/25 bg-info/10 text-info-foreground",
};

const TOAST_ICON_MAP = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
} satisfies Record<ToastIntent, typeof Info>;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) =>
      current.map((toast) =>
        toast.id === toastId ? { ...toast, exiting: true } : toast
      )
    );
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== toastId));
    }, 160);
  }, []);

  const showToast = useCallback(
    ({
      title,
      description,
      intent = "info",
    }: {
      title?: string;
      description: string;
      intent?: ToastIntent;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const record: ToastRecord = {
        id,
        intent,
        title: title || DEFAULT_TITLES[intent],
        description,
        exiting: false,
      };

      setToasts((current) => [...current, record]);
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <Suspense fallback={null}>
        <UrlToastListener />
      </Suspense>
      {children}
      <div
        className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const Icon = TOAST_ICON_MAP[toast.intent];

          return (
            <div
              key={toast.id}
              role={toast.intent === "error" ? "alert" : "status"}
              data-state={toast.exiting ? "closing" : "open"}
              className={cn(
                "toast-motion pointer-events-auto rounded-xl border px-4 py-3 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.6)] backdrop-blur-xl",
                TOAST_STYLES[toast.intent]
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  <p className="mt-1 text-sm leading-5 text-current/85">
                    {toast.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="inline-flex size-7 items-center justify-center rounded-full text-current/75 transition-[background-color,color,transform] duration-150 ease-[var(--ease-out-ui)] hover:bg-white/10 hover:text-current active:scale-95"
                  aria-label="Dismiss toast"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context.showToast;
}

export function useActionToast(params: {
  message?: string;
  title?: string;
  intent?: ToastIntent;
}) {
  const showToast = useToast();
  const lastMessage = useRef("");

  useEffect(() => {
    if (!params.message || params.message === lastMessage.current) {
      return;
    }

    lastMessage.current = params.message;
    showToast({
      title: params.title,
      description: params.message,
      intent: params.intent,
    });
  }, [params.intent, params.message, params.title, showToast]);
}

function UrlToastListener() {
  const showToast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrlToast = useRef("");

  useEffect(() => {
    const description = searchParams.get(TOAST_QUERY_PARAM);

    if (!description) {
      return;
    }

    const title = searchParams.get(TOAST_TITLE_QUERY_PARAM) || undefined;
    const intentValue = searchParams.get(TOAST_INTENT_QUERY_PARAM);
    const intent: ToastIntent =
      intentValue === "success" || intentValue === "error" || intentValue === "info"
        ? intentValue
        : "info";
    const signature = `${intent}|${title ?? ""}|${description}`;

    if (lastUrlToast.current === signature) {
      return;
    }

    lastUrlToast.current = signature;
    window.setTimeout(() => {
      showToast({ title, description, intent });
    }, 0);

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete(TOAST_QUERY_PARAM);
    nextSearchParams.delete(TOAST_TITLE_QUERY_PARAM);
    nextSearchParams.delete(TOAST_INTENT_QUERY_PARAM);
    const nextQuery = nextSearchParams.toString();
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, {
      scroll: false,
    });
  }, [pathname, router, searchParams, showToast]);

  return null;
}
