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
}

interface Overview {
  project: Project;
  sessions: { id: string; user_id: string; first_name: string; last_name: string; clock_in_at: string; clock_out_at: string | null; session_date: string }[];
  agents: { id: string; first_name: string; last_name: string; email: string }[];
}

export default function ProjectManagerDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "project_manager" && user.role !== "admin") {
      router.replace("/");
      return;
    }
    loadProjects();
  }, [user, token, router]);

  async function loadProjects() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiRequest<Project[]>("/project-sessions/pm/projects", {}, token);
      setProjects(Array.isArray(res) ? res : []);
      if (res.length && !selectedId) setSelectedId(res[0].id);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token || !selectedId) {
      setOverview(null);
      return;
    }
    apiRequest<Overview>(`/project-sessions/pm/projects/${selectedId}/overview`, {}, token)
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [token, selectedId]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Project Dashboard</h1>
      <p className="text-slate-400">View everything in your assigned project(s).</p>
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="card">
          <p className="text-slate-500">You are not assigned as project manager to any project.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {projects.map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${selectedId === p.id ? "bg-brand/20 text-brand-light" : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"}`}
                >
                  {p.name}
                </button>
                <Link href={`/project/break-config?projectId=${p.id}&name=${encodeURIComponent(p.name)}`} className="rounded px-2 py-1 text-xs text-slate-400 hover:underline">Break config</Link>
              </span>
            ))}
          </div>

          {overview && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="mb-4 text-lg font-medium text-slate-50">Project: {overview.project.name}</h2>
                {overview.project.description && <p className="text-slate-400 mb-4">{overview.project.description}</p>}
                <h3 className="mb-2 text-sm font-medium text-slate-300">Agents who have logged into this project</h3>
                <ul className="list-disc pl-5 text-slate-300">
                  {overview.agents.length === 0 ? <li className="text-slate-500">None yet</li> : overview.agents.map((a) => (
                    <li key={a.id}>{a.first_name} {a.last_name} ({a.email})</li>
                  ))}
                </ul>
              </div>
              <div className="card overflow-auto">
                <h3 className="mb-4 text-lg font-medium text-slate-50">Recent sessions (last 7 days)</h3>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-slate-400">
                      <th className="p-2">Agent</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Clock in</th>
                      <th className="p-2">Clock out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.sessions.map((s) => (
                      <tr key={s.id} className="border-b border-slate-800">
                        <td className="p-2 text-slate-50">{s.first_name} {s.last_name}</td>
                        <td className="p-2 text-slate-300">{s.session_date}</td>
                        <td className="p-2 text-slate-300">{new Date(s.clock_in_at).toLocaleTimeString()}</td>
                        <td className="p-2 text-slate-300">{s.clock_out_at ? new Date(s.clock_out_at).toLocaleTimeString() : "—"}</td>
                      </tr>
                    ))}
                    {overview.sessions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">No sessions in this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
