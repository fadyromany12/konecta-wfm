"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface Project {
  id: string;
  name: string;
  description: string | null;
  pm_count?: number;
}

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface ProjectManager {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function AdminProjectsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignPmProjectId, setAssignPmProjectId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [pmUserId, setPmUserId] = useState("");
  const [projectManagers, setProjectManagers] = useState<ProjectManager[]>([]);
  const [assignRtaProjectId, setAssignRtaProjectId] = useState<string | null>(null);
  const [rtaList, setRtaList] = useState<ProjectManager[]>([]);
  const [rtaUserId, setRtaUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/");
      return;
    }
    load();
  }, [user, token, router]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [projRes, usersRes] = await Promise.all([
        apiRequest<Project[] | { data?: Project[] }>("/projects", {}, token),
        apiRequest<UserRow[] | { data?: UserRow[] }>("/admin/users?limit=500", {}, token),
      ]);
      setProjects(Array.isArray(projRes) ? projRes : (projRes?.data ?? []));
      setUsers(Array.isArray(usersRes) ? usersRes : (usersRes?.data ?? []));
    } catch {
      setProjects([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPms(projectId: string) {
    if (!token) return;
    try {
      const res = await apiRequest<ProjectManager[]>(`/projects/${projectId}/managers`, {}, token);
      setProjectManagers(Array.isArray(res) ? res : []);
      setAssignPmProjectId(projectId);
      setPmUserId("");
    } catch {
      setProjectManagers([]);
    }
  }

  async function loadRta(projectId: string) {
    if (!token) return;
    try {
      const res = await apiRequest<ProjectManager[]>(`/projects/${projectId}/rta`, {}, token);
      setRtaList(Array.isArray(res) ? res : []);
      setAssignRtaProjectId(projectId);
      setRtaUserId("");
    } catch {
      setRtaList([]);
    }
  }

  async function addRta(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !assignRtaProjectId || !rtaUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/projects/${assignRtaProjectId}/rta`, { method: "POST", body: JSON.stringify({ userId: rtaUserId }) }, token);
      loadRta(assignRtaProjectId);
      load();
    } catch (err: any) {
      setError((err as Error)?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeRta(projectId: string, userId: string) {
    if (!token) return;
    try {
      await apiRequest(`/projects/${projectId}/rta/${userId}`, { method: "DELETE" }, token);
      loadRta(projectId);
      load();
    } catch (err: any) {
      setError((err as Error)?.message || "Failed");
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/projects", {
        method: "POST",
        body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null }),
      }, token);
      setFormName("");
      setFormDesc("");
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !editingId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/projects/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null }),
      }, token);
      setEditingId(null);
      setFormName("");
      setFormDesc("");
      load();
    } catch (err: any) {
      setError(err?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteProject(id: string) {
    if (!token || !confirm("Delete this project?")) return;
    try {
      await apiRequest(`/projects/${id}`, { method: "DELETE" }, token);
      load();
    } catch (err: any) {
      setError((err as Error)?.message || "Failed");
    }
  }

  async function addPm(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !assignPmProjectId || !pmUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/projects/${assignPmProjectId}/managers`, {
        method: "POST",
        body: JSON.stringify({ userId: pmUserId }),
      }, token);
      loadPms(assignPmProjectId);
      load();
    } catch (err: any) {
      setError((err as Error)?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function removePm(projectId: string, userId: string) {
    if (!token) return;
    try {
      await apiRequest(`/projects/${projectId}/managers/${userId}`, { method: "DELETE" }, token);
      loadPms(projectId);
      load();
    } catch (err: any) {
      setError((err as Error)?.message || "Failed");
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-50">Projects</h1>
        <button type="button" onClick={() => { setShowForm(true); setEditingId(null); setFormName(""); setFormDesc(""); setError(null); }} className="btn-primary">
          Add project
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}

      {showForm && (
        <div className="card">
          <h2 className="mb-4 text-lg font-medium text-slate-50">New project</h2>
          <form onSubmit={createProject} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Name</label>
              <input className="input-field w-full" value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Description</label>
              <textarea className="input-field w-full" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Creating…" : "Create"}</button>
              <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {editingId && (
        <div className="card">
          <h2 className="mb-4 text-lg font-medium text-slate-50">Edit project</h2>
          <form onSubmit={updateProject} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Name</label>
              <input className="input-field w-full" value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Description</label>
              <textarea className="input-field w-full" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => { setEditingId(null); setFormName(""); setFormDesc(""); }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {assignRtaProjectId && (
        <div className="card">
          <h2 className="mb-4 text-lg font-medium text-slate-50">Assign RTA</h2>
          <ul className="mb-4 list-disc pl-5 text-slate-300">
            {rtaList.map((r) => (
              <li key={r.user_id} className="flex items-center gap-2">
                {r.first_name} {r.last_name}
                <button type="button" onClick={() => removeRta(assignRtaProjectId, r.user_id)} className="text-xs text-red-400 hover:underline">Remove</button>
              </li>
            ))}
            {rtaList.length === 0 && <li className="text-slate-500">None</li>}
          </ul>
          <form onSubmit={addRta} className="flex gap-2">
            <select className="input-field flex-1" value={rtaUserId} onChange={(e) => setRtaUserId(e.target.value)}>
              <option value="">Select user...</option>
              {users.filter((u) => !rtaList.some((r) => r.user_id === u.id)).map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={submitting || !rtaUserId}>{submitting ? "Adding..." : "Add RTA"}</button>
            <button type="button" onClick={() => setAssignRtaProjectId(null)} className="btn-secondary">Close</button>
          </form>
        </div>
      )}

      {assignPmProjectId && (
        <div className="card">
          <h2 className="mb-4 text-lg font-medium text-slate-50">Assign project manager</h2>
          <ul className="mb-4 list-disc pl-5 text-slate-300">
            {projectManagers.map((pm) => (
              <li key={pm.user_id} className="flex items-center gap-2">
                {pm.first_name} {pm.last_name}
                <button type="button" onClick={() => removePm(assignPmProjectId, pm.user_id)} className="text-xs text-red-400 hover:underline">Remove</button>
              </li>
            ))}
            {projectManagers.length === 0 && <li className="text-slate-500">None</li>}
          </ul>
          <form onSubmit={addPm} className="flex gap-2">
            <select className="input-field flex-1" value={pmUserId} onChange={(e) => setPmUserId(e.target.value)}>
              <option value="">Select user…</option>
              {users.filter((u) => !projectManagers.some((pm) => pm.user_id === u.id)).map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={submitting || !pmUserId}>{submitting ? "Adding…" : "Add PM"}</button>
            <button type="button" onClick={() => setAssignPmProjectId(null)} className="btn-secondary">Close</button>
          </form>
        </div>
      )}

      <div className="card overflow-auto">
        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Name</th>
                <th className="p-2">Description</th>
                <th className="p-2">PMs</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-slate-800">
                  <td className="p-2 text-slate-50">{p.name}</td>
                  <td className="p-2 text-slate-300 max-w-xs truncate">{p.description || "—"}</td>
                  <td className="p-2 text-slate-300">{p.pm_count ?? 0}</td>
                  <td className="p-2">
                    <button type="button" onClick={() => { setEditingId(p.id); setFormName(p.name); setFormDesc(p.description || ""); }} className="mr-2 text-brand-light hover:underline">Edit</button>
                    <button type="button" onClick={() => loadPms(p.id)} className="mr-2 text-slate-300 hover:underline">Assign PM</button>
                    <button type="button" onClick={() => loadRta(p.id)} className="mr-2 text-slate-300 hover:underline">Assign RTA</button>
                    <Link href={`/project/break-config?projectId=${p.id}&name=${encodeURIComponent(p.name)}`} className="mr-2 text-slate-300 hover:underline">Break config</Link>
                    <button type="button" onClick={() => deleteProject(p.id)} className="text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">No projects yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
