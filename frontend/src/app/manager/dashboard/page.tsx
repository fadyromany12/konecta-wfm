"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";
import { toast } from "../../../lib/toast";

interface TeamRow {
  user_id: string;
  first_name: string;
  last_name: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: string | null;
  is_late: boolean;
  is_early_logout: boolean;
}

interface PendingAgent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

interface ResetRequest {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  requested_at: string;
}

export default function ManagerDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [pendingSwaps, setPendingSwaps] = useState(0);
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [settingTempId, setSettingTempId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "manager") {
      router.replace("/");
      return;
    }
    load();
  }, [user, token, date]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [data, leave, swaps, agents, resets] = await Promise.all([
        apiRequest<TeamRow[]>(`/manager/attendance/team?date=${date}`, {}, token),
        apiRequest<unknown[]>(`/manager/leave/pending`, {}, token),
        apiRequest<unknown[]>(`/shift-swaps/manager/pending`, {}, token),
        apiRequest<PendingAgent[]>(`/manager/pending-approvals`, {}, token),
        apiRequest<ResetRequest[]>(`/manager/password-reset-requests`, {}, token),
      ]);
      setTeam(data);
      setPendingLeave(leave.length);
      setPendingSwaps(swaps.length);
      setPendingAgents(agents);
      setResetRequests(resets);
    } catch {
      setTeam([]);
      setPendingAgents([]);
      setResetRequests([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(userId: string) {
    if (!token) return;
    setApprovingId(userId);
    try {
      const res = await apiRequest<{ tempPassword: string; userName: string }>(`/manager/approve/${userId}`, { method: "POST" }, token);
      setTempPassword({ name: res.userName, password: res.tempPassword });
      toast.success("Agent approved. Give them the temporary password.");
      await load();
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
      const res = await apiRequest<{ tempPassword: string }>(`/manager/set-temp-password/${userId}`, { method: "POST" }, token);
      const r = resetRequests.find((x) => x.user_id === userId);
      setTempPassword({ name: r ? `${r.first_name} ${r.last_name}` : "User", password: res.tempPassword });
      toast.success("Temporary password set. Give it to the agent.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setSettingTempId(null);
    }
  }

  if (!user) return null;

  const clockedIn = team.filter((t) => t.clock_in && !t.clock_out).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Team Dashboard</h1>
        <p className="page-subtitle">Attendance and activity for {date}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card transition-all duration-300 hover:border-brand/30 hover:shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Team size</p>
          <p className="mt-2 text-2xl font-bold text-white">{team.length}</p>
        </div>
        <div className="card transition-all duration-300 hover:border-brand/30 hover:shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Clocked in today</p>
          <p className="mt-2 text-2xl font-bold text-brand-light">{clockedIn}</p>
        </div>
        <div className="card transition-all duration-300 hover:border-brand/30 hover:shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Late today</p>
          <p className="mt-2 text-2xl font-bold text-amber-400">
            {team.filter((t) => t.is_late).length}
          </p>
        </div>
        <Link
          href="/manager/approvals"
          className="card-hover block"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending approvals</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {pendingLeave + pendingSwaps} <span className="text-sm font-normal text-slate-400">total</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Leave: {pendingLeave} · Swaps: {pendingSwaps}</p>
        </Link>
      </div>

      {pendingAgents.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-lg font-medium text-slate-200">Pending agent approvals</h2>
          <p className="mb-3 text-sm text-slate-400">Approve new agents and give them a temporary password. They will change it in Profile.</p>
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
                {pendingAgents.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800">
                    <td className="p-2 font-medium text-slate-100">{a.first_name} {a.last_name}</td>
                    <td className="p-2 text-slate-300">{a.email}</td>
                    <td className="p-2 text-slate-400">{new Date(a.created_at).toLocaleDateString()}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(a.id)}
                        disabled={!!approvingId}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {approvingId === a.id ? "Approving…" : "Approve & set temp password"}
                      </button>
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
          <p className="mb-3 text-sm text-slate-400">Set a temporary password for agents who requested a reset. They will change it in Profile.</p>
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
                      <button
                        type="button"
                        onClick={() => handleSetTempPassword(r.user_id)}
                        disabled={!!settingTempId}
                        className="rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {settingTempId === r.user_id ? "Setting…" : "Set temp password"}
                      </button>
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
            <p className="mt-2 text-slate-300">Give this to <strong>{tempPassword.name}</strong>. They must change it in Profile after logging in.</p>
            <p className="mt-3 rounded-lg bg-slate-800 p-3 font-mono text-lg tracking-wider text-white">{tempPassword.password}</p>
            <button type="button" onClick={() => setTempPassword(null)} className="btn-primary mt-4 w-full">
              Done
            </button>
          </div>
        </div>
      )}

      <div className="card transition-shadow duration-300 hover:shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-200">Team attendance</h2>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          />
        </div>
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/4 rounded bg-slate-700/50" />
            <div className="h-10 rounded bg-slate-700/50" />
            <div className="h-10 rounded bg-slate-700/50" />
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="p-2">Agent</th>
                  <th className="p-2">Clock in</th>
                  <th className="p-2">Clock out</th>
                  <th className="p-2">Hours</th>
                  <th className="p-2">Late</th>
                  <th className="p-2">Early out</th>
                </tr>
              </thead>
              <tbody>
                {team.map((t) => (
                  <tr key={t.user_id} className="border-b border-slate-800">
                    <td className="p-2 font-medium text-slate-100">
                      {t.first_name} {t.last_name}
                    </td>
                    <td className="p-2">
                      {t.clock_in ? new Date(t.clock_in).toLocaleTimeString() : "-"}
                    </td>
                    <td className="p-2">
                      {t.clock_out ? new Date(t.clock_out).toLocaleTimeString() : t.clock_in ? "—" : "-"}
                    </td>
                    <td className="p-2">{t.total_hours ? String(t.total_hours).replace("00:", "") : "-"}</td>
                    <td className="p-2">{t.is_late ? "Yes" : "No"}</td>
                    <td className="p-2">{t.is_early_logout ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {team.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500">
                      No team members or no data for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
