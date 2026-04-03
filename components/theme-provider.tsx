"use client";

import * as React from "react";
import {
  DEFAULT_THEME,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  type AppTheme,
  type ResolvedTheme,
  isAppTheme,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: AppTheme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: AppTheme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme() {
  return window.matchMedia(THEME_MEDIA_QUERY).matches ? "dark" : "light";
}

function getResolvedThemeFromDocument(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function resolveTheme(theme: AppTheme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyResolvedTheme(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
}

function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = React.useState<AppTheme>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() =>
    typeof document === "undefined" ? "light" : getResolvedThemeFromDocument()
  );

  const setTheme = React.useCallback((nextTheme: AppTheme) => {
    setThemeState(isAppTheme(nextTheme) ? nextTheme : DEFAULT_THEME);
  }, []);

  React.useEffect(() => {
    const nextResolvedTheme = resolveTheme(theme);
    setResolvedTheme(nextResolvedTheme);
    applyResolvedTheme(nextResolvedTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);

    const handleSystemChange = () => {
      if (theme !== "system") {
        return;
      }

      const nextResolvedTheme = getSystemTheme();
      setResolvedTheme(nextResolvedTheme);
      applyResolvedTheme(nextResolvedTheme);
    };

    handleSystemChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemChange);

      return () => mediaQuery.removeEventListener("change", handleSystemChange);
    }

    mediaQuery.addListener(handleSystemChange);

    return () => mediaQuery.removeListener(handleSystemChange);
  }, [theme]);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      setThemeState(isAppTheme(event.newValue) ? event.newValue : DEFAULT_THEME);
    };

    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
