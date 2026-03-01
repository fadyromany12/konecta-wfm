"use client";

import "./globals.css";
import { ReactNode, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { useAuthStore } from "../lib/authStore";
import { useThemeStore } from "../lib/themeStore";
import Sidebar from "../components/Sidebar";
import ThemeToggle from "../components/ThemeToggle";
import NotificationsDropdown from "../components/NotificationsDropdown";
import { PageTransition } from "../components/ui/AnimatedWrapper";

const AUTH_PAGES = new Set(["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/pending"]);

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useRef(false);
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const themeHydrate = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    hydrate();
    themeHydrate();
  }, [hydrate, themeHydrate]);

  const isAuthPage = AUTH_PAGES.has(pathname);
  const showSidebar = user && !isAuthPage;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("konecta-theme");document.documentElement.classList.toggle("dark",t==="dark");})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased transition-theme" style={{ transition: "background 0.4s cubic-bezier(0.32, 0.72, 0, 1), color 0.4s cubic-bezier(0.32, 0.72, 0, 1)" }}>
        <div className="flex min-h-screen transition-colors duration-[400ms]">
          {showSidebar && (
            <aside className="hidden shrink-0 md:block">
              <Sidebar />
            </aside>
          )}
          <main className="flex min-h-screen flex-1 flex-col">
            {showSidebar && (
              <header className="flex items-center justify-end gap-3 border-b border-[var(--border-sidebar)] bg-[var(--bg-sidebar)] px-4 py-3 backdrop-blur-sm transition-[background,border-color] duration-[400ms]">
                <NotificationsDropdown />
                <ThemeToggle />
              </header>
            )}
            <div className="flex-1 p-6 md:p-8 lg:p-10">
              <div className="mx-auto max-w-6xl">
                {isAuthPage ? children : <PageTransition>{children}</PageTransition>}
              </div>
            </div>
          </main>
        </div>
        <Toaster position="top-right" richColors closeButton theme={theme} />
      </body>
    </html>
  );
}
