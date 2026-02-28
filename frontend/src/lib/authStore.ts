import { create } from "zustand";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "agent" | "manager" | "admin";
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("konecta_auth", JSON.stringify({ user, token }));
    }
    set({ user, token });
  },
  clearAuth: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("konecta_auth");
    }
    set({ user: null, token: null });
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("konecta_auth");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { user: User; token: string };
      set({ user: parsed.user, token: parsed.token });
    } catch {
      window.localStorage.removeItem("konecta_auth");
    }
  },
}));

