"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface Holiday {
  id: string;
  date: string;
  name: string;
  is_public: boolean;
}

interface Department {
  id: string;
  name: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  visible_from: string;
  visible_to: string | null;
  created_at: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<"holidays" | "departments" | "announcements">("holidays");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    const load = async () => {
      setLoading(true);
      try {
        const [h, d, a] = await Promise.all([
          apiRequest<Holiday[]>("/holidays", {}, token),
          apiRequest<Department[]>("/departments", {}, token),
          apiRequest<Announcement[]>("/announcements/all", {}, token),
        ]);
        setHolidays(h);
        setDepartments(d);
        setAnnouncements(a);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, user?.role]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Settings</h1>
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {(["holidays", "departments", "announcements"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${
              tab === t ? "bg-brand text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "holidays" && (
        <HolidaysSection
          list={holidays}
          token={token!}
          onUpdate={() => apiRequest<Holiday[]>("/holidays", {}, token!).then(setHolidays)}
        />
      )}
      {tab === "departments" && (
        <DepartmentsSection
          list={departments}
          token={token!}
          onUpdate={() => apiRequest<Department[]>("/departments", {}, token!).then(setDepartments)}
        />
      )}
      {tab === "announcements" && (
        <AnnouncementsSection
          list={announcements}
          token={token!}
          onUpdate={() => apiRequest<Announcement[]>("/announcements/all", {}, token!).then(setAnnouncements)}
        />
      )}
      {loading && <p className="text-slate-400">Loading…</p>}
    </div>
  );
}

function HolidaysSection({
  list,
  token,
  onUpdate,
}: {
  list: Holiday[];
  token: string;
  onUpdate: () => void;
}) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!date || !name.trim()) return;
    setAdding(true);
    try {
      await apiRequest("/holidays", { method: "POST", body: JSON.stringify({ date, name: name.trim(), is_public: true }) }, token);
      setDate("");
      setName("");
      onUpdate();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiRequest(`/holidays/${id}`, { method: "DELETE" }, token);
      onUpdate();
    } catch {
      // ignore
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-medium text-slate-200">Holiday calendar</h2>
      <div className="flex flex-wrap gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name" className="input-field min-w-[180px]" />
        <button type="button" onClick={add} disabled={adding} className="btn-primary">Add</button>
      </div>
      <ul className="space-y-2">
        {list.map((h) => (
          <li key={h.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2 text-sm text-slate-200">
            <span>{h.date} – {h.name}</span>
            <button type="button" onClick={() => remove(h.id)} className="text-red-400 hover:underline">Delete</button>
          </li>
        ))}
        {list.length === 0 && <p className="text-slate-500">No holidays defined.</p>}
      </ul>
    </div>
  );
}

function DepartmentsSection({
  list,
  token,
  onUpdate,
}: {
  list: Department[];
  token: string;
  onUpdate: () => void;
}) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await apiRequest("/departments", { method: "POST", body: JSON.stringify({ name: name.trim() }) }, token);
      setName("");
      onUpdate();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiRequest(`/departments/${id}`, { method: "DELETE" }, token);
      onUpdate();
    } catch {
      // ignore
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-medium text-slate-200">Departments</h2>
      <div className="flex flex-wrap gap-3">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Department name" className="input-field min-w-[200px]" />
        <button type="button" onClick={add} disabled={adding} className="btn-primary">Add</button>
      </div>
      <ul className="space-y-2">
        {list.map((d) => (
          <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2 text-sm text-slate-200">
            <span>{d.name}</span>
            <button type="button" onClick={() => remove(d.id)} className="text-red-400 hover:underline">Delete</button>
          </li>
        ))}
        {list.length === 0 && <p className="text-slate-500">No departments yet.</p>}
      </ul>
    </div>
  );
}

function AnnouncementsSection({
  list,
  token,
  onUpdate,
}: {
  list: Announcement[];
  token: string;
  onUpdate: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!title.trim() || !body.trim()) return;
    setAdding(true);
    try {
      await apiRequest("/announcements", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      }, token);
      setTitle("");
      setBody("");
      onUpdate();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiRequest(`/announcements/${id}`, { method: "DELETE" }, token);
      onUpdate();
    } catch {
      // ignore
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-medium text-slate-200">Announcement board</h2>
      <div className="space-y-2">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input-field w-full" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" rows={3} className="input-field w-full resize-y" />
        <button type="button" onClick={add} disabled={adding} className="btn-primary">Post announcement</button>
      </div>
      <ul className="space-y-3">
        {list.map((a) => (
          <li key={a.id} className="rounded-lg bg-slate-800/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-200">{a.title}</p>
                <p className="mt-1 text-sm text-slate-400">{a.body.slice(0, 120)}{a.body.length > 120 ? "…" : ""}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</p>
              </div>
              <button type="button" onClick={() => remove(a.id)} className="text-red-400 hover:underline shrink-0">Delete</button>
            </div>
          </li>
        ))}
        {list.length === 0 && <p className="text-slate-500">No announcements.</p>}
      </ul>
    </div>
  );
}
