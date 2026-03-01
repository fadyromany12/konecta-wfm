import { create } from "zustand";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  hydrate: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "dark",
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("konecta-theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    set({ theme });
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("konecta-theme") as Theme | null;
    const theme = stored === "light" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
    set({ theme });
  },
}));
