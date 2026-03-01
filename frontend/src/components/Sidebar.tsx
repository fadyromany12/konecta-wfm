"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "../lib/authStore";
import { LogOut, User } from "lucide-react";

const agentNav = [
  { href: "/agent/dashboard", label: "Dashboard" },
  { href: "/agent/schedule", label: "Schedule" },
  { href: "/agent/requests", label: "My Requests" },
  { href: "/agent/swap", label: "Swap Shifts" },
  { href: "/agent/projects", label: "My Projects" },
  { href: "/grid", label: "Activity Grid" },
  { href: "/org-view", label: "Org View" },
  { href: "/profile", label: "Profile" },
];

const managerNav = [
  { href: "/manager/dashboard", label: "Team Dashboard" },
  { href: "/manager/wallboard", label: "Wallboard" },
  { href: "/manager/approvals", label: "Approvals" },
  { href: "/manager/transfers", label: "Transfers" },
  { href: "/manager/reports", label: "Reports" },
  { href: "/manager/schedule", label: "Schedule" },
  { href: "/manager/team", label: "Team Members" },
  { href: "/manager/activities", label: "Coachings & Meetings" },
  { href: "/manager/hierarchy", label: "Hierarchy" },
  { href: "/grid", label: "Activity Grid" },
  { href: "/org-view", label: "Org View" },
  { href: "/profile", label: "Profile" },
];

const adminNav = [
  { href: "/admin/users", label: "All Users" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/reports", label: "System Reports" },
  { href: "/admin/roles", label: "Roles & Permissions" },
  { href: "/admin/wallboard", label: "Wallboard" },
  { href: "/admin/schedule", label: "Schedule Management" },
  { href: "/admin/hierarchy", label: "Hierarchy" },
  { href: "/admin/audit", label: "Audit Logs" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/grid", label: "Activity Grid" },
  { href: "/org-view", label: "Org View" },
  { href: "/profile", label: "Profile" },
];

const projectManagerNav = [
  { href: "/project-manager/dashboard", label: "Project Dashboard" },
  { href: "/agent/projects", label: "My Projects" },
  { href: "/grid", label: "Activity Grid" },
  { href: "/org-view", label: "Org View" },
  { href: "/profile", label: "Profile" },
];

const rtaNav = [
  { href: "/rta/dashboard", label: "Scheduler" },
  { href: "/grid", label: "Activity Grid" },
  { href: "/profile", label: "Profile" },
];

function SidebarInner() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const nav = useMemo(() => {
    if (!user) return agentNav;
    switch (user.role) {
      case "admin": return adminNav;
      case "manager": return managerNav;
      case "project_manager": return projectManagerNav;
      case "rta": return rtaNav;
      default: return agentNav;
    }
  }, [user?.role]);

  if (!user) return null;

  return (
    <motion.aside
      className="sidebar-bg flex w-72 min-h-screen flex-col shrink-0 backdrop-blur-xl border-r border-white/10 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.4)]"
      initial={false}
      transition={{ type: "tween", duration: 0.2 }}
    >
      {/* Logo */}
      <div className="border-b border-[var(--border-sidebar)] px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Konecta
          </span>
          <span
            className="rounded-md bg-[rgb(var(--color-brand))] px-2 py-0.5 text-xs font-semibold text-white shadow-sm"
            style={{ backgroundColor: "rgb(var(--color-brand))" }}
          >
            WFM
          </span>
        </Link>
      </div>

      {/* Nav – sliding pill via layoutId */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {user.role}
        </p>
        <ul className="space-y-0.5">
          {nav.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className="relative flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 hover:bg-[rgb(var(--color-brand)/0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-brand))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-sidebar)]"
                >
                  {active && (
                    <motion.span
                      layoutId="activeNav"
                      className="absolute inset-0 rounded-xl bg-[rgb(var(--color-brand)/0.2)]"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                      style={{ border: "1px solid rgba(124, 58, 237, 0.25)" }}
                    />
                  )}
                  <span className={`relative z-10 ${active ? "text-[rgb(var(--color-brand-light))]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User + Logout */}
      <div className="sidebar-footer-bg mt-auto shrink-0 px-4 py-5">
        <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-brand)/0.2)]">
            <User className="h-4 w-4 text-[rgb(var(--color-brand-light))]" />
          </div>
          <div className="min-w-0 flex-1 truncate">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">
              {user.first_name} {user.last_name}
            </p>
            <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            clearAuth();
            window.location.href = "/login";
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-input)] bg-transparent py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all duration-200 hover:border-[rgb(var(--color-brand)/0.5)] hover:bg-[rgb(var(--color-brand)/0.08)] hover:text-[var(--text-primary)]"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </motion.aside>
  );
}

export default memo(SidebarInner);
