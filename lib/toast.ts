export type ToastIntent = "success" | "error" | "info";

export const TOAST_QUERY_PARAM = "toast";
export const TOAST_TITLE_QUERY_PARAM = "toastTitle";
export const TOAST_INTENT_QUERY_PARAM = "toastIntent";

export type ToastPayload = {
  description: string;
  title?: string;
  intent?: ToastIntent;
};

export function withToast(path: string, toast: ToastPayload) {
  const [pathWithoutHash, hash = ""] = path.split("#");
  const [pathname, query = ""] = pathWithoutHash.split("?");
  const searchParams = new URLSearchParams(query);

  searchParams.set(TOAST_QUERY_PARAM, toast.description);

  if (toast.title) {
    searchParams.set(TOAST_TITLE_QUERY_PARAM, toast.title);
  } else {
    searchParams.delete(TOAST_TITLE_QUERY_PARAM);
  }

  if (toast.intent) {
    searchParams.set(TOAST_INTENT_QUERY_PARAM, toast.intent);
  } else {
    searchParams.delete(TOAST_INTENT_QUERY_PARAM);
  }

  const nextQuery = searchParams.toString();
  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}
