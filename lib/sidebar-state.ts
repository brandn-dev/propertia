export const SIDEBAR_COOKIE_NAME = "sidebar_state";

export function parseSidebarOpenState(
  value: string | null | undefined,
  fallback = true
) {
  if (value == null) {
    return fallback;
  }

  return value !== "false";
}
