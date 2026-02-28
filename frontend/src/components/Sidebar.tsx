"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "../lib/authStore";

const agentNav = [
  { href: "/agent/dashboard", label: "Dashboard" },
  { href: "/agent/schedule", label: "Schedule" },
  { href: "/agent/requests", label: "My Requests" },
  { href: "/agent/swap", label: "Swap Shifts" },
  { href: "/agent/profile", label: "Profile" },
];

const managerNav = [
  { href: "/manager/dashboard", label: "Team Dashboard" },
  { href: "/manager/approvals", label: "Approvals" },
  { href: "/manager/reports", label: "Reports" },
  { href: "/manager/schedule", label: "Schedule" },
  { href: "/manager/team", label: "Team Members" },
];

const adminNav = [
  { href: "/admin/users", label: "All Users" },
  { href: "/admin/reports", label: "System Reports" },
  { href: "/admin/schedule", label: "Schedule Management" },
  { href: "/admin/audit", label: "Audit Logs" },
  { href: "/admin/settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  if (!user) return null;

  const nav =
    user.role === "admin"
      ? adminNav
      : user.role === "manager"
        ? managerNav
        : agentNav;

  return (
    <aside className="flex w-64 flex-col border-r border-slate-700/80 bg-slate-900/90 backdrop-blur-sm">
      <div className="border-b border-slate-700/80 p-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white">Konecta</span>
          <span className="rounded bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">WFM</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {user.role}
        </p>
        {nav.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              pathname === href
                ? "bg-brand/20 text-brand-light"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-slate-700/80 p-4">
        <p className="truncate px-2 text-sm font-medium text-slate-200">
          {user.first_name} {user.last_name}
        </p>
        <p className="truncate px-2 text-xs text-slate-500">{user.email}</p>
        <button
          type="button"
          onClick={() => {
            clearAuth();
            window.location.href = "/login";
          }}
          className="mt-3 w-full rounded-xl border border-slate-600 py-2 text-center text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
