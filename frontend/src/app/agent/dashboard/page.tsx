"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import AnnouncementsWidget from "../../../components/AnnouncementsWidget";
import { Clock, Activity, Calendar, Zap } from "lucide-react";

interface Attendance {
  id: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: string | null;
  is_late: boolean;
  is_early_logout: boolean;
  overtime_duration: string | null;
}

type AuxType =
  | "break"
  | "lunch"
  | "last_break"
  | "meeting"
  | "coaching"
  | "training"
  | "technical_issue"
  | "floor_support"
  | "available";

interface AuxLog {
  id: string;
  aux_type: AuxType;
  start_time: string;
  end_time: string | null;
  duration: string | null;
  over_limit: boolean;
}

export default function AgentDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const [clockLoading, setClockLoading] = useState(false);
  const [auxLoading, setAuxLoading] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [auxHistory, setAuxHistory] = useState<AuxLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
    } else if (user.role !== "agent") {
      router.replace("/");
    } else {
      void refreshData();
    }
  }, [router, user, token]);

  async function refreshData() {
    if (!token) return;
    try {
      const [att, aux] = await Promise.all([
        apiRequest<Attendance[]>("/attendance/me", {}, token),
        apiRequest<AuxLog[]>("/aux/me", {}, token),
      ]);
      setAttendance(att);
      setAuxHistory(aux);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    }
  }

  async function handleClock(action: "clock-in" | "clock-out") {
    if (!token) return;
    setClockLoading(true);
    setError(null);
    try {
      await apiRequest(`/attendance/${action}`, { method: "POST" }, token);
      await refreshData();
      toast.success(action === "clock-in" ? "Clocked in" : "Clocked out");
    } catch (err: any) {
      setError(err.message || "Clock action failed");
      toast.error(err?.message || "Clock action failed");
    } finally {
      setClockLoading(false);
    }
  }

  async function handleAux(auxType: AuxType | "end") {
    if (!token) return;
    setAuxLoading(true);
    setError(null);
    try {
      if (auxType === "end") {
        await apiRequest("/aux/end", { method: "POST" }, token);
      } else {
        await apiRequest(
          "/aux/start",
          { method: "POST", body: JSON.stringify({ auxType }) },
          token,
        );
      }
      await refreshData();
      toast.success(auxType === "end" ? "AUX ended" : `Now ${auxType.replace("_", " ")}`);
    } catch (err: any) {
      setError(err.message || "AUX action failed");
      toast.error(err?.message || "AUX action failed");
    } finally {
      setAuxLoading(false);
    }
  }

  const openAttendance = attendance.find((a) => !a.clock_out) || null;
  const openAux = auxHistory.find((a) => !a.end_time) || null;

  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    if (!openAttendance) {
      setLiveSeconds(0);
      return;
    }
    const start = new Date(openAttendance.clock_in).getTime();
    const tick = () => setLiveSeconds(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openAttendance]);

  const formatLive = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const todaySessions = attendance.filter(
    (a) => a.clock_in && a.clock_in.slice(0, 10) === new Date().toISOString().slice(0, 10)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Agent Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, {user?.first_name} {user?.last_name}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card transition-all duration-300 hover:border-brand/30 hover:shadow-brand/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/20 text-brand-light">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Status</p>
              <p className="font-semibold text-white">{openAttendance ? "Clocked in" : "Clocked out"}</p>
            </div>
          </div>
        </div>
        <div className="card transition-all duration-300 hover:border-brand/30 hover:shadow-brand/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700/50 text-slate-300">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">AUX</p>
              <p className="font-semibold text-white">{openAux ? openAux.aux_type.replace("_", " ") : "Available"}</p>
            </div>
          </div>
        </div>
        <div className="card transition-all duration-300 hover:border-brand/30 hover:shadow-brand/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700/50 text-slate-300">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Today</p>
              <p className="font-semibold text-white">{todaySessions.length} session{todaySessions.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
        <div className="card transition-all duration-300 hover:border-brand/30 hover:shadow-brand/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Live</p>
              <p className="font-mono font-semibold text-white">{openAttendance ? formatLive(liveSeconds) : "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <AnnouncementsWidget />

      <div className="grid gap-5 md:grid-cols-3">
        <div className="card transition-shadow duration-300 hover:shadow-xl">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Time Tracking</h2>
          {openAttendance && (
            <p className="mb-2 text-lg font-mono font-medium text-violet-300">
              Live: {formatLive(liveSeconds)}
            </p>
          )}
          <p className="mb-2 text-xs text-slate-400">
            Status:{" "}
            <span className="font-medium text-slate-100">
              {openAttendance ? "Clocked in" : "Clocked out"}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              disabled={clockLoading || !!openAttendance}
              onClick={() => handleClock("clock-in")}
            >
              Clock In
            </button>
            <button
              className="btn-outline flex-1"
              disabled={clockLoading || !openAttendance}
              onClick={() => handleClock("clock-out")}
            >
              Clock Out
            </button>
          </div>
        </div>

        <div className="card transition-shadow duration-300 hover:shadow-xl md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">AUX Status</h2>
          <p className="mb-2 text-xs text-slate-400">
            Current:{" "}
            <span className="font-medium text-slate-100">
              {openAux ? openAux.aux_type : "Available"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "break",
              "lunch",
              "last_break",
              "meeting",
              "coaching",
              "training",
              "technical_issue",
              "floor_support",
            ].map((type) => (
              <button
                key={type}
                className="btn-outline text-xs capitalize"
                disabled={auxLoading}
                onClick={() => handleAux(type as AuxType)}
              >
                {type.replace("_", " ")}
              </button>
            ))}
            <button
              className="btn-primary text-xs"
              disabled={auxLoading}
              onClick={() => handleAux("available")}
            >
              Set Available
            </button>
            <button
              className="btn-outline text-xs"
              disabled={auxLoading || !openAux}
              onClick={() => handleAux("end")}
            >
              End Current AUX
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card transition-shadow duration-300 hover:shadow-xl">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Recent Attendance</h2>
          <div className="max-h-64 overflow-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 text-left">In</th>
                  <th className="py-2 text-left">Out</th>
                  <th className="py-2 text-left">Hours</th>
                  <th className="py-2 text-left">Late</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-b border-slate-900">
                    <td className="py-1">
                      {new Date(a.clock_in).toLocaleString()}
                    </td>
                    <td className="py-1">
                      {a.clock_out ? new Date(a.clock_out).toLocaleString() : "-"}
                    </td>
                    <td className="py-1">
                      {a.total_hours ? a.total_hours.replace("00:", "") : "-"}
                    </td>
                    <td className="py-1">{a.is_late ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-slate-500">
                      No records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card transition-shadow duration-300 hover:shadow-xl">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Recent AUX</h2>
          <div className="max-h-64 overflow-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 text-left">Type</th>
                  <th className="py-2 text-left">Start</th>
                  <th className="py-2 text-left">End</th>
                  <th className="py-2 text-left">Over limit</th>
                </tr>
              </thead>
              <tbody>
                {auxHistory.map((a) => (
                  <tr key={a.id} className="border-b border-slate-900">
                    <td className="py-1 capitalize">
                      {a.aux_type.replace("_", " ")}
                    </td>
                    <td className="py-1">
                      {new Date(a.start_time).toLocaleString()}
                    </td>
                    <td className="py-1">
                      {a.end_time ? new Date(a.end_time).toLocaleString() : "-"}
                    </td>
                    <td className="py-1">{a.over_limit ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {auxHistory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-slate-500">
                      No records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

