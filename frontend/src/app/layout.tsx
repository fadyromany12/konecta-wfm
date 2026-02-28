"use client";

import "./globals.css";
import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { useAuthStore } from "../lib/authStore";
import Sidebar from "../components/Sidebar";
import ThemeToggle from "../components/ThemeToggle";
import NotificationsDropdown from "../components/NotificationsDropdown";

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const isAuthPage = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/pending"].includes(pathname);
  const showSidebar = user && !isAuthPage;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-app text-slate-100 antialiased">
        <div className="flex min-h-screen">
          {showSidebar && (
            <aside className="hidden shrink-0 md:block">
              <Sidebar />
            </aside>
          )}
          <main className="flex flex-1 flex-col">
            {showSidebar && (
              <header className="flex items-center justify-end gap-3 border-b border-slate-800/80 bg-slate-900/40 px-4 py-3 backdrop-blur-sm">
                <NotificationsDropdown />
                <ThemeToggle />
              </header>
            )}
            <div className="flex-1 p-6 md:p-8 lg:p-10">
              <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
            </div>
          </main>
        </div>
        <Toaster position="top-right" richColors closeButton theme="dark" />
      </body>
    </html>
  );
}
