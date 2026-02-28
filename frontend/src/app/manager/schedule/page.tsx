"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface ScheduleRow {
  id: string;
  user_id: string;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  day_type: string;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
}

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function getMonthRange(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return {
    from: `${y}-${String(m + 1).padStart(2, "0")}-01`,
    to: `${y}-${String(m + 1).padStart(2, "0")}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, "0")}`,
  };
}

export default function ManagerSchedulePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [view, setView] = useState<"weekly" | "monthly">("weekly");
  const [cursor, setCursor] = useState(new Date());
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, TeamMember>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "manager") {
      router.replace("/");
      return;
    }
    loadTeam();
  }, [user, token, router]);

  useEffect(() => {
    if (!token) return;
    loadSchedule();
  }, [token, view, cursor]);

  async function loadTeam() {
    if (!token) return;
    try {
      const team = await apiRequest<TeamMember[]>("/manager/team", {}, token);
      const map: Record<string, TeamMember> = {};
      team.forEach((t) => (map[t.id] = t));
      setTeamMap(map);
    } catch {
      setTeamMap({});
    }
  }

  async function loadSchedule() {
    if (!token) return;
    setLoading(true);
    try {
      const range = view === "weekly" ? getWeekRange(cursor) : getMonthRange(cursor);
      const data = await apiRequest<ScheduleRow[]>(
        `/manager/schedule/team?from=${range.from}&to=${range.to}`,
        {},
        token,
      );
      setSchedule(data);
    } catch {
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const range = view === "weekly" ? getWeekRange(cursor) : getMonthRange(cursor);

  function nameFor(userId: string) {
    const t = teamMap[userId];
    return t ? `${t.first_name} ${t.last_name}` : "—";
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-50">Team Schedule</h1>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-slate-700 bg-slate-800/50 p-1">
          <button
            type="button"
            onClick={() => setView("weekly")}
            className={`rounded px-3 py-1 text-sm ${view === "weekly" ? "bg-violet-600 text-white" : "text-slate-400"}`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setView("monthly")}
            className={`rounded px-3 py-1 text-sm ${view === "monthly" ? "bg-violet-600 text-white" : "text-slate-400"}`}
          >
            Monthly
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const d = new Date(cursor);
              d.setDate(d.getDate() - (view === "weekly" ? 7 : 30));
              setCursor(d);
            }}
            className="btn-outline text-sm"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date(cursor);
              d.setDate(d.getDate() + (view === "weekly" ? 7 : 30));
              setCursor(d);
            }}
            className="btn-outline text-sm"
          >
            Next
          </button>
        </div>
        <span className="text-sm text-slate-400">
          {range.from} → {range.to}
        </span>
      </div>
      {loading ? (
        <p className="text-slate-400">Loading schedule...</p>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Member</th>
                <th className="p-2">Date</th>
                <th className="p-2">Type</th>
                <th className="p-2">Start</th>
                <th className="p-2">End</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((s) => (
                <tr key={s.id} className="border-b border-slate-800">
                  <td className="p-2 text-slate-50">{nameFor(s.user_id)}</td>
                  <td className="p-2 text-slate-300">{s.date}</td>
                  <td className="p-2 capitalize text-slate-300">{s.day_type.replace("_", " ")}</td>
                  <td className="p-2 text-slate-300">
                    {s.shift_start
                      ? new Date(s.shift_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "-"}
                  </td>
                  <td className="p-2 text-slate-300">
                    {s.shift_end
                      ? new Date(s.shift_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "-"}
                  </td>
                </tr>
              ))}
              {schedule.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500">
                    No schedule for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
