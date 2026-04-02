export const THEME_STORAGE_KEY = "theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
export const THEME_VALUES = ["light", "dark", "system"] as const;
export const DEFAULT_THEME = "system" as const;

export type AppTheme = (typeof THEME_VALUES)[number];
export type ResolvedTheme = "light" | "dark";

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === "light" || value === "dark" || value === "system";
}

export function getThemeInitScript() {
  return `
    (() => {
      try {
        const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
        const defaultTheme = ${JSON.stringify(DEFAULT_THEME)};
        const mediaQuery = ${JSON.stringify(THEME_MEDIA_QUERY)};
        const root = document.documentElement;
        const storedTheme = localStorage.getItem(storageKey) || defaultTheme;
        const resolvedTheme =
          storedTheme === "system"
            ? window.matchMedia(mediaQuery).matches
              ? "dark"
              : "light"
            : storedTheme;

        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
        root.style.colorScheme = resolvedTheme;
      } catch (_error) {}
    })();
  `;
}
