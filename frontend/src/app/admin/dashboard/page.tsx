"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";
import { toast } from "../../../lib/toast";

interface PendingAgent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  manager_id: string | null;
  created_at: string;
  manager_first_name?: string;
  manager_last_name?: string;
}

interface ResetRequest {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  requested_at: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [settingTempId, setSettingTempId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    apiRequest<PendingAgent[]>(`/admin/pending-approvals`, {}, token).then(setPendingAgents).catch(() => setPendingAgents([]));
    apiRequest<ResetRequest[]>(`/admin/password-reset-requests`, {}, token).then(setResetRequests).catch(() => setResetRequests([]));
  }, [token, user?.role]);

  async function handleApprove(userId: string) {
    if (!token) return;
    setApprovingId(userId);
    try {
      const res = await apiRequest<{ tempPassword: string }>(`/admin/approve/${userId}`, { method: "POST" }, token);
      const a = pendingAgents.find((x) => x.id === userId);
      setTempPassword({ name: a ? `${a.first_name} ${a.last_name}` : "User", password: res.tempPassword });
      toast.success("Agent approved.");
      setPendingAgents((prev) => prev.filter((p) => p.id !== userId));
    } catch (err: any) {
      toast.error(err?.message || "Approve failed");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleSetTempPassword(userId: string) {
    if (!token) return;
    setSettingTempId(userId);
    try {
      const res = await apiRequest<{ tempPassword: string }>(`/admin/set-temp-password/${userId}`, { method: "POST" }, token);
      const r = resetRequests.find((x) => x.user_id === userId);
      setTempPassword({ name: r ? `${r.first_name} ${r.last_name}` : "User", password: res.tempPassword });
      toast.success("Temporary password set.");
      setResetRequests((prev) => prev.filter((x) => x.user_id !== userId));
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setSettingTempId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Manage users, reports, schedules, and settings</p>
      </div>

      {pendingAgents.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-lg font-medium text-slate-200">Pending agent approvals</h2>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Manager</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {pendingAgents.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800">
                    <td className="p-2 font-medium text-slate-100">{a.first_name} {a.last_name}</td>
                    <td className="p-2 text-slate-300">{a.email}</td>
                    <td className="p-2 text-slate-400">{a.manager_first_name ? `${a.manager_first_name} ${a.manager_last_name}` : "—"}</td>
                    <td className="p-2">
                      <button type="button" onClick={() => handleApprove(a.id)} disabled={!!approvingId} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50">Approve & set temp password</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resetRequests.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-lg font-medium text-slate-200">Password reset requests</h2>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Requested</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {resetRequests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800">
                    <td className="p-2 font-medium text-slate-100">{r.first_name} {r.last_name}</td>
                    <td className="p-2 text-slate-300">{r.email}</td>
                    <td className="p-2 text-slate-400">{new Date(r.requested_at).toLocaleString()}</td>
                    <td className="p-2">
                      <button type="button" onClick={() => handleSetTempPassword(r.user_id)} disabled={!!settingTempId} className="rounded bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50">Set temp password</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setTempPassword(null)}>
          <div className="card max-w-md border-2 border-amber-500/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-amber-400">Temporary password</h3>
            <p className="mt-2 text-slate-300">Give this to <strong>{tempPassword.name}</strong>. They must change it in Profile.</p>
            <p className="mt-3 rounded-lg bg-slate-800 p-3 font-mono text-lg tracking-wider text-white">{tempPassword.password}</p>
            <button type="button" onClick={() => setTempPassword(null)} className="btn-primary mt-4 w-full">Done</button>
          </div>
        </div>
      )}

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
