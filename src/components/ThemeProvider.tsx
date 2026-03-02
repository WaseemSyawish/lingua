import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
  forceDark: () => () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [forcedDark, setForcedDark] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("lingua-theme") as Theme | null;
    if (stored) setThemeState(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function apply() {
      if (forcedDark > 0) {
        setResolvedTheme("dark");
        root.classList.add("dark");
        return;
      }
      const resolved =
        theme === "system"
          ? mediaQuery.matches
            ? "dark"
            : "light"
          : theme;
      setResolvedTheme(resolved);
      root.classList.toggle("dark", resolved === "dark");
    }

    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, [theme, forcedDark]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("lingua-theme", t);
  }

  /** Call forceDark() on mount, returns cleanup function for unmount */
  function forceDark() {
    setForcedDark((c) => c + 1);
    return () => setForcedDark((c) => c - 1);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, forceDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
