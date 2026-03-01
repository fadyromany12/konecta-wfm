"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../lib/themeStore";

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const hydrate = useThemeStore((s) => s.hydrate);
  const dark = theme === "dark";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function toggle() {
    setTheme(dark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition-all duration-200 hover:border-[rgb(var(--color-brand)/0.4)] hover:bg-[rgb(var(--color-brand)/0.08)] hover:text-[rgb(var(--color-brand-light))]"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
