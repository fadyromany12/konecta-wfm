"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { safeLabel } from "../../../lib/format";

interface ScheduleRow {
  id: string;
  user_id: string;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  day_type: string;
  version?: number;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
}

const DAY_TYPES = ["work", "off", "holiday", "leave"];

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
  const [teamList, setTeamList] = useState<TeamMember[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, TeamMember>>({});
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ user_id: "", date: "", shift_start: "09:00", shift_end: "17:00", day_type: "work" });

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
      const data = await apiRequest<TeamMember[] | { data?: TeamMember[] }>("/manager/team?limit=500", {}, token);
      const team = Array.isArray(data) ? data : (data && typeof data === "object" ? (data.data ?? []) : []);
      setTeamList(Array.isArray(team) ? team : []);
      const map: Record<string, TeamMember> = {};
      (Array.isArray(team) ? team : []).forEach((t) => (map[t.id] = t));
      setTeamMap(map);
    } catch {
      setTeamList([]);
      setTeamMap({});
    }
  }

  function openAdd() {
    const range = view === "weekly" ? getWeekRange(cursor) : getMonthRange(cursor);
    setEditing(null);
    setForm({ user_id: teamList[0]?.id ?? "", date: range.from, shift_start: "09:00", shift_end: "17:00", day_type: "work" });
    setShowForm(true);
  }

  function openEdit(row: ScheduleRow) {
    setEditing(row);
    const start = row.shift_start ? new Date(row.shift_start).toTimeString().slice(0, 5) : "09:00";
    const end = row.shift_end ? new Date(row.shift_end).toTimeString().slice(0, 5) : "17:00";
    setForm({ user_id: row.user_id, date: row.date, shift_start: start, shift_end: end, day_type: row.day_type });
    setShowForm(true);
  }

  async function saveShift(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        user_id: form.user_id,
        date: form.date,
        shift_start: form.shift_start ? `${form.date}T${form.shift_start}:00` : null,
        shift_end: form.shift_end ? `${form.date}T${form.shift_end}:00` : null,
        day_type: form.day_type,
      };
      if (editing?.id != null && editing?.version != null) {
        body.id = editing.id;
        body.version = editing.version;
      }
      await apiRequest("/manager/schedule", { method: "PUT", body: JSON.stringify(body) }, token);
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? "Schedule updated" : "Shift added");
      loadSchedule();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
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
        <button type="button" onClick={openAdd} className="btn-primary text-sm">
          Add shift
        </button>
      </div>

      {showForm && (
        <div className="card max-w-md">
          <h2 className="mb-3 text-lg font-medium text-slate-200">{editing ? "Edit shift" : "Add shift"}</h2>
          <form onSubmit={saveShift} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Team member</label>
              <select
                value={form.user_id}
                onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                className="input-field w-full"
                required
                disabled={!!editing}
              >
                <option value="">Select…</option>
                {teamList.map((t) => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input-field w-full" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm text-slate-400">Start</label>
                <input type="time" value={form.shift_start} onChange={(e) => setForm((f) => ({ ...f, shift_start: e.target.value }))} className="input-field w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">End</label>
                <input type="time" value={form.shift_end} onChange={(e) => setForm((f) => ({ ...f, shift_end: e.target.value }))} className="input-field w-full" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Day type</label>
              <select value={form.day_type} onChange={(e) => setForm((f) => ({ ...f, day_type: e.target.value }))} className="input-field w-full">
                {DAY_TYPES.map((t) => (
                  <option key={t} value={t}>{safeLabel(t)}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

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
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((s) => (
                <tr key={s.id} className="border-b border-slate-800">
                  <td className="p-2 text-slate-50">{nameFor(s.user_id)}</td>
                  <td className="p-2 text-slate-300">{s.date}</td>
                  <td className="p-2 capitalize text-slate-300">{safeLabel(s.day_type)}</td>
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
                  <td className="p-2">
                    <button type="button" onClick={() => openEdit(s)} className="text-brand-400 hover:underline text-sm">Edit</button>
                  </td>
                </tr>
              ))}
              {schedule.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">
                    No schedule for this period. Click &quot;Add shift&quot; to create one.
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
