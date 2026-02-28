"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

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

export default function ManagerDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [pendingSwaps, setPendingSwaps] = useState(0);

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
      const [data, leave, swaps] = await Promise.all([
        apiRequest<TeamRow[]>(`/manager/attendance/team?date=${date}`, {}, token),
        apiRequest<unknown[]>(`/manager/leave/pending`, {}, token),
        apiRequest<unknown[]>(`/shift-swaps/manager/pending`, {}, token),
      ]);
      setTeam(data);
      setPendingLeave(leave.length);
      setPendingSwaps(swaps.length);
    } catch {
      setTeam([]);
    } finally {
      setLoading(false);
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
