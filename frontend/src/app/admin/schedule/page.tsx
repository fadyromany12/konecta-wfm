"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface ScheduleRow {
  id: string;
  user_id: string;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  day_type: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

const DAY_TYPES = ["work", "off", "holiday", "leave"];

export default function AdminSchedulePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [editCell, setEditCell] = useState<{ userId: string; date: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    Promise.all([
      apiRequest<UserRow[]>("/admin/users", {}, token),
      apiRequest<ScheduleRow[]>(`/admin/schedules?from=${from}&to=${to}`, {}, token),
    ])
      .then(([u, s]) => {
        setUsers(u);
        setSchedules(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, user?.role, from, to]);

  async function doImport() {
    if (!token || !importFile) return;
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", importFile);
    try {
      const base = typeof window !== "undefined" ? "/api/proxy" : (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000/api");
      const res = await fetch(`${base}/admin/schedules/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.imported !== undefined) setImportResult({ imported: data.imported, errors: data.errors || [] });
      else setImportResult({ imported: 0, errors: [data?.error?.message || "Import failed"] });
    } catch (e) {
      setImportResult({ imported: 0, errors: [(e as Error).message] });
    }
    setImportFile(null);
    setLoading(true);
    apiRequest<ScheduleRow[]>(`/admin/schedules?from=${from}&to=${to}`, {}, token)
      .then(setSchedules)
      .finally(() => setLoading(false));
  }

  async function saveCell(userId: string, date: string, shiftStart: string, shiftEnd: string, dayType: string) {
    if (!token) return;
    setSaving(true);
    try {
      await apiRequest("/admin/schedules", {
        method: "PUT",
        body: JSON.stringify({
          user_id: userId,
          date,
          shift_start: shiftStart || null,
          shift_end: shiftEnd || null,
          day_type: dayType,
        }),
      }, token);
      setEditCell(null);
      const res = await apiRequest<ScheduleRow[]>(`/admin/schedules?from=${from}&to=${to}`, {}, token);
      setSchedules(res);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const scheduleMap = new Map<string, ScheduleRow>();
  schedules.forEach((s) => scheduleMap.set(`${s.user_id}:${s.date}`, s));

  const dates: string[] = [];
  for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Schedule Management</h1>

      <div className="card space-y-4">
        <h2 className="text-lg font-medium text-slate-200">Bulk import (CSV)</h2>
        <p className="text-sm text-slate-400">
          CSV columns: email, date (YYYY-MM-DD), shift_start (HH:mm), shift_end (HH:mm), day_type (work|off|holiday|leave).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv"
            className="text-sm text-slate-300"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={doImport}
            disabled={!importFile}
            className="btn-primary"
          >
            Import
          </button>
        </div>
        {importResult && (
          <p className="text-sm text-slate-300">
            Imported: {importResult.imported}. {importResult.errors.length > 0 && `Errors: ${importResult.errors.join("; ")}`}
          </p>
        )}
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field" />
          </div>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="sticky left-0 z-10 min-w-[140px] bg-slate-900 p-2">User</th>
                  {dates.slice(0, 14).map((date) => (
                    <th key={date} className="min-w-[90px] p-2">
                      {new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" })}
                    </th>
                  ))}
                  {dates.length > 14 && <th className="p-2">…</th>}
                </tr>
              </thead>
              <tbody>
                {users.filter((u) => u.role === "agent").map((u) => (
                  <tr key={u.id} className="border-b border-slate-800">
                    <td className="sticky left-0 z-10 bg-slate-900/95 p-2 text-slate-200">
                      {u.first_name} {u.last_name}
                    </td>
                    {(dates.length > 14 ? dates.slice(0, 14) : dates).map((date) => {
                      const key = `${u.id}:${date}`;
                      const row = scheduleMap.get(key);
                      const isEditing = editCell?.userId === u.id && editCell?.date === date;
                      const start = row?.shift_start ? new Date(row.shift_start).toTimeString().slice(0, 5) : "";
                      const end = row?.shift_end ? new Date(row.shift_end).toTimeString().slice(0, 5) : "";
                      const dayType = row?.day_type || "work";
                      return (
                        <td key={date} className="min-w-[90px] p-1">
                          {isEditing ? (
                            <EditCellForm
                              start={start}
                              end={end}
                              dayType={dayType}
                              onSave={(s, e, dt) => saveCell(u.id, date, s, e, dt)}
                              onCancel={() => setEditCell(null)}
                              saving={saving}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditCell({ userId: u.id, date })}
                              className="w-full rounded border border-slate-700 bg-slate-800/50 px-2 py-1 text-left text-xs text-slate-300 hover:bg-slate-700"
                            >
                              {row ? `${start || "—"}–${end || "—"} (${dayType})` : "Add"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    {dates.length > 14 && <td className="p-2 text-slate-500">+{dates.length - 14} more</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EditCellForm({
  start,
  end,
  dayType,
  onSave,
  onCancel,
  saving,
}: {
  start: string;
  end: string;
  dayType: string;
  onSave: (start: string, end: string, dayType: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const [dt, setDt] = useState(dayType);
  return (
    <div className="space-y-1 rounded border border-slate-600 bg-slate-800 p-2">
      <input
        type="time"
        value={s}
        onChange={(ev) => setS(ev.target.value)}
        className="mb-1 w-full rounded border border-slate-600 bg-slate-900 px-1 text-xs text-slate-200"
      />
      <input
        type="time"
        value={e}
        onChange={(ev) => setE(ev.target.value)}
        className="mb-1 w-full rounded border border-slate-600 bg-slate-900 px-1 text-xs text-slate-200"
      />
      <select
        value={dt}
        onChange={(ev) => setDt(ev.target.value)}
        className="w-full rounded border border-slate-600 bg-slate-900 px-1 text-xs text-slate-200"
      >
        {DAY_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <div className="flex gap-1">
        <button type="button" onClick={() => onSave(s, e, dt)} disabled={saving} className="rounded bg-brand px-2 py-0.5 text-xs text-white">
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded bg-slate-600 px-2 py-0.5 text-xs text-slate-200">
          Cancel
        </button>
      </div>
    </div>
  );
}
