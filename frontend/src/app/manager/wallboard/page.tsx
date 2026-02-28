"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";
import { Users, Coffee, AlertCircle, Clock } from "lucide-react";

interface WallboardAgent {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  current_aux: string | null;
  is_late: boolean;
  clock_in: string | null;
  clock_out: string | null;
}

interface WallboardData {
  date: string;
  agentsOnline: number;
  agentsOnBreak: number;
  lateToday: number;
  overtimeRunning: number;
  agents: WallboardAgent[];
}

export default function ManagerWallboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<WallboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "manager" && user.role !== "admin") {
      router.replace("/");
      return;
    }
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user, token, router]);

  async function load() {
    if (!token) return;
    try {
      const d = await apiRequest<WallboardData>("/wallboard", {}, token);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const statusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "aux":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "off":
        return "bg-slate-600/20 text-slate-400 border-slate-500/40";
      case "clocked_out":
        return "bg-slate-600/20 text-slate-400 border-slate-500/40";
      default:
        return "bg-slate-600/20 text-slate-400 border-slate-500/40";
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Live Wallboard</h1>
      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 p-4 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Users className="h-5 w-5" />
                <span className="text-sm font-medium">Online</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-white">{data.agentsOnline}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 p-4 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Coffee className="h-5 w-5" />
                <span className="text-sm font-medium">On Break</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-amber-400">{data.agentsOnBreak}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 p-4 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Late Today</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-red-400">{data.lateToday}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 p-4 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">Overtime</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-violet-400">{data.overtimeRunning}</p>
            </div>
          </div>
          <div className="card overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="p-3">Agent</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Current AUX</th>
                  <th className="p-3">Late</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800">
                    <td className="p-3 font-medium text-slate-50">
                      {a.first_name} {a.last_name}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-medium ${statusColor(a.status)}`}>
                        {a.status === "aux" && a.current_aux ? a.current_aux.replace("_", " ") : a.status === "available" ? "Available" : a.status === "off" ? "Off" : "Clocked out"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{a.current_aux ? a.current_aux.replace("_", " ") : "—"}</td>
                    <td className="p-3">{a.is_late ? <span className="text-red-400">Yes</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-slate-500">No wallboard data.</p>
      )}
    </div>
  );
}
