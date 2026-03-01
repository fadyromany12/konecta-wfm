"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/authStore";
import { apiRequest } from "../../lib/api";
import { formatTimeHHmm, formatTimeHHmmss } from "../../lib/format";

interface GridEvent {
  type: string;
  start: string;
  end: string;
  duration_minutes: number;
  violation?: string;
  label?: string;
}

interface UserGrid {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  events: GridEvent[];
  violations: { type: string; description: string }[];
}

const GRID_HOURS = 36;
const TILE_COLORS: Record<string, string> = {
  clock_in: "bg-emerald-600 border-emerald-500",
  clock_out: "bg-slate-500 border-slate-400",
  work: "bg-blue-600/90 border-blue-500",
  aux: "bg-amber-500/90 border-amber-400",
  scheduled_shift: "bg-slate-600 border-slate-500",
  scheduled_break_1: "bg-amber-600/80 border-amber-500",
  scheduled_break_2: "bg-orange-600/80 border-orange-500",
  scheduled_break_3: "bg-amber-700/80 border-amber-600",
  coaching: "bg-violet-600 border-violet-500",
  meeting: "bg-blue-500 border-blue-400",
  training: "bg-cyan-600 border-cyan-500",
};

function getTileColor(type: string, violation?: string): string {
  if (violation) return "bg-red-500/90 border-red-400";
  return TILE_COLORS[type] || "bg-slate-600 border-slate-500";
}

export default function ActivityGridPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [userIdFilter, setUserIdFilter] = useState("");
  const [projectId, setProjectId] = useState("");
  const [agents, setAgents] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<{ date: string; users: UserGrid[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<{ userId: string; eventIndex: number } | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserGrid | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role === "manager" && token) {
      apiRequest<{ items?: { id: string; first_name: string; last_name: string }[] }>("/manager/team", {}, token).then((d) => setAgents(Array.isArray(d) ? d : (d.items ?? []))).catch(() => setAgents([]));
    }
    if (user.role === "admin" && token) {
      apiRequest<{ items?: { id: string; first_name: string; last_name: string; role: string }[] }>("/admin/users?limit=500", {}, token)
        .then((data) => {
          const users = Array.isArray(data) ? data : (data.items ?? []);
          setAgents(users.filter((u) => u.role === "agent").map((u) => ({ id: u.id, first_name: u.first_name, last_name: u.last_name })));
        })
        .catch(() => setAgents([]));
    }
    if ((user.role === "admin" || user.role === "rta") && token) {
      apiRequest<{ id: string; name: string }[]>("/project-sessions/projects", {}, token).then(setProjects).catch(() => setProjects([]));
    }
  }, [user, token, router]);

  useEffect(() => {
    if (user?.role === "rta" && token && projectId) {
      apiRequest<{ id: string; first_name: string; last_name: string }[]>(`/rta/projects/${projectId}/agents`, {}, token).then(setAgents).catch(() => setAgents([]));
    }
  }, [user?.role, token, projectId]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ date });
    if (userIdFilter) params.set("user_id", userIdFilter);
    if (projectId) params.set("project_id", projectId);
    apiRequest<{ date: string; users: UserGrid[] }>(`/grid/activity?${params}`, {}, token)
      .then(setData)
      .catch((e) => {
        setData(null);
        setError((e as Error)?.message || "Failed");
      })
      .finally(() => setLoading(false));
  }, [token, date, userIdFilter, projectId]);

  const dayStart = useMemo(() => new Date(date + "T00:00:00"), [date]);
  const dayEnd = useMemo(() => new Date(dayStart.getTime() + GRID_HOURS * 60 * 60 * 1000), [dayStart]);
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let h = 0; h <= GRID_HOURS; h += 2) {
      const d = new Date(dayStart.getTime() + h * 60 * 60 * 1000);
      labels.push(formatTimeHHmm(d));
    }
    return labels;
  }, [dayStart]);

  if (!user) return null;

  const canFilterAgent = user.role === "manager" || user.role === "admin" || user.role === "rta";
  const canFilterProject = user.role === "admin" || user.role === "rta";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Activity Grid</h1>
        <p className="mt-1 text-sm text-slate-400">
          36-hour view (shifts ending next day). Clock-in/out, breaks, AUX, coachings, meetings. Times in 24h format.
        </p>
      </div>
      {error && <div className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</div>}

      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Date</label>
          <input type="date" className="input-field w-full min-w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {canFilterAgent && agents.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Agent</label>
            <select className="input-field min-w-[180px]" value={userIdFilter} onChange={(e) => setUserIdFilter(e.target.value)}>
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
              ))}
            </select>
          </div>
        )}
        {canFilterProject && projects.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Project</label>
            <select className="input-field min-w-[180px]" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card py-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Event types</p>
        <div className="flex flex-wrap gap-3 text-xs">
          {["work", "aux", "scheduled_shift", "coaching", "meeting", "clock_in", "clock_out"].map((t) => (
            <span key={t} className={`rounded border px-2 py-1 ${getTileColor(t)} text-white`}>
              {t.replace(/_/g, " ")}
            </span>
          ))}
          <span className="rounded border border-red-400 bg-red-500/90 px-2 py-1 text-white">violation</span>
        </div>
      </div>

      {loading ? (
        <div className="card py-12 text-center text-slate-400">Loading…</div>
      ) : data?.users.length === 0 ? (
        <div className="card py-12 text-center text-slate-500">No data for this date.</div>
      ) : (
        <div className="flex gap-4">
          <div className="card overflow-x-auto flex-1 min-w-0">
            <div className="min-w-[900px]">
              {/* Time axis */}
              <div className="mb-2 flex border-b border-slate-700 pb-2">
                <div className="w-40 shrink-0 text-xs font-medium text-slate-500">Agent</div>
                <div className="relative flex flex-1" style={{ minWidth: 540 }}>
                  {timeLabels.map((label, i) => (
                    <div
                      key={i}
                      className="shrink-0 text-center text-[10px] text-slate-500"
                      style={{ width: `${(2 / GRID_HOURS) * 100}%` }}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {data?.users.map((u) => (
                <div
                  key={u.user_id}
                  className={`flex items-stretch border-b border-slate-800/80 py-2 last:border-0 transition-colors ${selectedUser?.user_id === u.user_id ? "bg-slate-700/30" : "hover:bg-slate-800/30"}`}
                  onClick={() => setSelectedUser(selectedUser?.user_id === u.user_id ? null : u)}
                >
                  <div className="w-40 shrink-0 pr-3 cursor-pointer">
                    <p className="truncate font-medium text-slate-100">{u.first_name} {u.last_name}</p>
                    {u.violations.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {u.violations.map((v, i) => (
                          <span key={i} className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                            {v.type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative flex-1 overflow-visible rounded bg-slate-900/60" style={{ minWidth: 540, height: 44 }}>
                    {u.events.length === 0 ? (
                      <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">No events</p>
                    ) : (
                      u.events.map((ev, i) => {
                        const start = new Date(ev.start);
                        const end = new Date(ev.end);
                        const startMs = Math.max(dayStart.getTime(), start.getTime());
                        const endMs = Math.min(dayEnd.getTime(), end.getTime());
                        const left = ((startMs - dayStart.getTime()) / (GRID_HOURS * 60 * 60 * 1000)) * 100;
                        const width = Math.max(2, ((endMs - startMs) / (GRID_HOURS * 60 * 60 * 1000)) * 100);
                        const color = getTileColor(ev.type, ev.violation);
                        const timeRange = `${formatTimeHHmm(ev.start)}–${formatTimeHHmm(ev.end)}`;
                        const isHovered = hoveredTile?.userId === u.user_id && hoveredTile?.eventIndex === i;
                        return (
                          <div
                            key={i}
                            className={`absolute top-1 bottom-1 rounded border py-0.5 px-1.5 text-[10px] font-medium text-white shadow-sm transition-transform duration-200 z-10 ${color} ${isHovered ? "scale-110 ring-2 ring-white/40" : "hover:scale-105"}`}
                            style={{
                              left: `${Math.max(0, left)}%`,
                              width: `${Math.min(width, 100 - left)}%`,
                              minWidth: 44,
                            }}
                            onMouseEnter={() => setHoveredTile({ userId: u.user_id, eventIndex: i })}
                            onMouseLeave={() => setHoveredTile(null)}
                          >
                            <span className="block truncate">{ev.label || ev.type}</span>
                            <span className="block truncate opacity-90">{timeRange}</span>
                            {isHovered && (
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-left whitespace-nowrap shadow-xl z-20 pointer-events-none">
                                <p className="font-semibold text-white">{ev.label || ev.type}</p>
                                <p>Since: {formatTimeHHmmss(ev.start)}</p>
                                <p>Till: {formatTimeHHmmss(ev.end)}</p>
                                <p>{ev.duration_minutes} min</p>
                                {ev.violation && <p className="text-red-400">{ev.violation}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Click a row to see full events on the right. Hover tiles to magnify and see since/till.
            </p>
          </div>

          {/* Events history side panel */}
          <div className="w-72 shrink-0">
            <div className="card sticky top-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Events history</h3>
              {selectedUser ? (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  <p className="text-slate-200 font-medium">{selectedUser.first_name} {selectedUser.last_name}</p>
                  {selectedUser.events.map((ev, i) => (
                    <div key={i} className={`rounded border p-2 text-xs ${getTileColor(ev.type, ev.violation)} text-white`}>
                      <p className="font-medium">{ev.label || ev.type}</p>
                      <p>Since: {formatTimeHHmmss(ev.start)}</p>
                      <p>Till: {formatTimeHHmmss(ev.end)}</p>
                      <p>{ev.duration_minutes} min</p>
                      {ev.violation && <p className="text-red-200 text-[10px]">{ev.violation}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Click an agent row to list their events here.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
