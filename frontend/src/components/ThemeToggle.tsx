"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <motion.button
      type="button"
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] text-[var(--text-secondary)] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-brand))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-sidebar)]"
      style={{ transition: "border-color 0.25s ease, background 0.25s ease, color 0.25s ease" }}
      whileHover={{ scale: 1.05, borderColor: "rgb(var(--color-brand) / 0.4)", backgroundColor: "rgb(var(--color-brand) / 0.1)" }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "tween", duration: 0.2 }}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="relative block h-5 w-5">
        <AnimatePresence mode="wait" initial={false}>
          {dark ? (
            <motion.span
              key="sun"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center text-[rgb(var(--color-brand-light))]"
            >
              <Sun className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Moon className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
