"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface Project {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ScheduleRow {
  id: string;
  user_id: string;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  break_1_start: string | null;
  break_1_end: string | null;
  break_2_start: string | null;
  break_2_end: string | null;
  break_3_start: string | null;
  break_3_end: string | null;
  day_type: string;
  first_name: string;
  last_name: string;
}

export default function RTADashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ user_id: string; date: string } | null>(null);
  const [form, setForm] = useState({
    shift_start: "",
    shift_end: "",
    break_1_start: "",
    break_1_end: "",
    break_2_start: "",
    break_2_end: "",
    break_3_start: "",
    break_3_end: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "rta" && user.role !== "admin") {
      router.replace("/");
      return;
    }
    apiRequest<Project[]>("/rta/projects", {}, token).then(setProjects).catch(() => setProjects([]));
  }, [user, token, router]);

  useEffect(() => {
    if (!token || !projectId) {
      setSchedules([]);
      setAgents([]);
      return;
    }
    apiRequest<Agent[]>(`/rta/projects/${projectId}/agents`, {}, token).then(setAgents).catch(() => setAgents([]));
  }, [token, projectId]);

  useEffect(() => {
    if (!token || !projectId || !from || !to) {
      setSchedules([]);
      return;
    }
    setLoading(true);
    apiRequest<ScheduleRow[]>(`/rta/projects/${projectId}/schedules?from=${from}&to=${to}`, {}, token)
      .then(setSchedules)
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, [token, projectId, from, to]);

  async function saveSchedule() {
    if (!token || !projectId || !editing) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/rta/projects/${projectId}/schedules`, {
        method: "PUT",
        body: JSON.stringify({
          user_id: editing.user_id,
          date: editing.date,
          shift_start: form.shift_start ? `${editing.date}T${form.shift_start}:00` : null,
          shift_end: form.shift_end ? `${editing.date}T${form.shift_end}:00` : null,
          break_1_start: form.break_1_start ? `${editing.date}T${form.break_1_start}:00` : null,
          break_1_end: form.break_1_end ? `${editing.date}T${form.break_1_end}:00` : null,
          break_2_start: form.break_2_start ? `${editing.date}T${form.break_2_start}:00` : null,
          break_2_end: form.break_2_end ? `${editing.date}T${form.break_2_end}:00` : null,
          break_3_start: form.break_3_start ? `${editing.date}T${form.break_3_start}:00` : null,
          break_3_end: form.break_3_end ? `${editing.date}T${form.break_3_end}:00` : null,
        }),
      }, token);
      setEditing(null);
      setSchedules((prev) => prev);
      if (projectId && from && to)
        apiRequest<ScheduleRow[]>(`/rta/projects/${projectId}/schedules?from=${from}&to=${to}`, {}, token).then(setSchedules);
    } catch (e: any) {
      setError((e as Error)?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function addEmptySchedule() {
    if (!token || !projectId || !newAgentId || !newDate) return;
    setAdding(true);
    setError(null);
    try {
      await apiRequest(`/rta/projects/${projectId}/schedules`, {
        method: "PUT",
        body: JSON.stringify({ user_id: newAgentId, date: newDate }),
      }, token);
      if (projectId && from && to) apiRequest<ScheduleRow[]>(`/rta/projects/${projectId}/schedules?from=${from}&to=${to}`, {}, token).then(setSchedules);
    } catch (e: any) {
      setError((e as Error)?.message || "Failed");
    } finally {
      setAdding(false);
    }
  }

  function openEdit(s: ScheduleRow) {
    setEditing({ user_id: s.user_id, date: s.date });
    setForm({
      shift_start: s.shift_start ? new Date(s.shift_start).toTimeString().slice(0, 5) : "",
      shift_end: s.shift_end ? new Date(s.shift_end).toTimeString().slice(0, 5) : "",
      break_1_start: s.break_1_start ? new Date(s.break_1_start).toTimeString().slice(0, 5) : "",
      break_1_end: s.break_1_end ? new Date(s.break_1_end).toTimeString().slice(0, 5) : "",
      break_2_start: s.break_2_start ? new Date(s.break_2_start).toTimeString().slice(0, 5) : "",
      break_2_end: s.break_2_end ? new Date(s.break_2_end).toTimeString().slice(0, 5) : "",
      break_3_start: s.break_3_start ? new Date(s.break_3_start).toTimeString().slice(0, 5) : "",
      break_3_end: s.break_3_end ? new Date(s.break_3_end).toTimeString().slice(0, 5) : "",
    });
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">RTA Scheduler</h1>
      <p className="text-slate-400">Manage login, logout and break times for all agents in a project. Shifts can start/end any time (same or next day).</p>
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}

      <div className="card flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Project</label>
          <select className="input-field min-w-[200px]" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">From</label>
          <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">To</label>
          <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {editing && (
        <div className="card">
          <h2 className="mb-4 text-lg font-medium text-slate-50">Edit schedule — {editing.date}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Login (time)</label>
              <input type="time" className="input-field w-full" value={form.shift_start} onChange={(e) => setForm((f) => ({ ...f, shift_start: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Logout (time)</label>
              <input type="time" className="input-field w-full" value={form.shift_end} onChange={(e) => setForm((f) => ({ ...f, shift_end: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Break 1 start</label>
              <input type="time" className="input-field w-full" value={form.break_1_start} onChange={(e) => setForm((f) => ({ ...f, break_1_start: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Break 1 end</label>
              <input type="time" className="input-field w-full" value={form.break_1_end} onChange={(e) => setForm((f) => ({ ...f, break_1_end: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Break 2 (lunch) start</label>
              <input type="time" className="input-field w-full" value={form.break_2_start} onChange={(e) => setForm((f) => ({ ...f, break_2_start: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Break 2 end</label>
              <input type="time" className="input-field w-full" value={form.break_2_end} onChange={(e) => setForm((f) => ({ ...f, break_2_end: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Break 3 start</label>
              <input type="time" className="input-field w-full" value={form.break_3_start} onChange={(e) => setForm((f) => ({ ...f, break_3_start: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Break 3 end</label>
              <input type="time" className="input-field w-full" value={form.break_3_end} onChange={(e) => setForm((f) => ({ ...f, break_3_end: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={saveSchedule} className="btn-primary" disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-auto">
        {loading ? (
          <p className="text-slate-400">Loading schedules...</p>
        ) : schedules.length === 0 ? (
          <p className="text-slate-500">No schedules in range. Select a project and date range, or add schedules via Edit.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Agent</th>
                <th className="p-2">Date</th>
                <th className="p-2">Login</th>
                <th className="p-2">Logout</th>
                <th className="p-2">Breaks</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-slate-800">
                  <td className="p-2 text-slate-50">{s.first_name} {s.last_name}</td>
                  <td className="p-2 text-slate-300">{s.date}</td>
                  <td className="p-2 text-slate-300">{s.shift_start ? new Date(s.shift_start).toLocaleTimeString() : "—"}</td>
                  <td className="p-2 text-slate-300">{s.shift_end ? new Date(s.shift_end).toLocaleTimeString() : "—"}</td>
                  <td className="p-2 text-slate-300">
                    {[s.break_1_start, s.break_2_start, s.break_3_start].filter(Boolean).length} set
                  </td>
                  <td className="p-2">
                    <button type="button" onClick={() => openEdit(s)} className="text-brand-light hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {projectId && agents.length > 0 && (
        <div className="card flex flex-wrap items-end gap-4">
          <h2 className="w-full text-lg font-medium text-slate-50">Add new schedule</h2>
          <select className="input-field min-w-[200px]" value={newAgentId} onChange={(e) => setNewAgentId(e.target.value)}>
            <option value="">Select agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
            ))}
          </select>
          <input type="date" className="input-field" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button type="button" onClick={addEmptySchedule} className="btn-primary" disabled={adding || !newAgentId}>{adding ? "Adding…" : "Create empty schedule"}</button>
        </div>
      )}
    </div>
  );
}
