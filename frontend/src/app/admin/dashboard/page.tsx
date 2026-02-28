"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../../lib/authStore";

export default function AdminDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/");
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Manage users, reports, schedules, and settings</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/users" className="card-hover block">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">All Users</p>
          <p className="mt-2 font-medium text-slate-100">Manage users, roles, approval</p>
        </Link>
        <Link href="/admin/reports" className="card-hover block">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">System Reports</p>
          <p className="mt-2 font-medium text-slate-100">Exports (CSV)</p>
        </Link>
        <Link href="/admin/schedule" className="card-hover block">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Schedule Management</p>
          <p className="mt-2 font-medium text-slate-100">Bulk upload, edit schedules</p>
        </Link>
        <Link href="/admin/audit" className="card-hover block">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit Logs</p>
          <p className="mt-2 font-medium text-slate-100">Activity history</p>
        </Link>
        <Link href="/admin/settings" className="card-hover block">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Settings</p>
          <p className="mt-2 font-medium text-slate-100">Holidays, departments, announcements</p>
        </Link>
      </div>
    </div>
  );
}
