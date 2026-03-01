"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface Session {
  id: string;
  project_id: string;
  project_name: string;
  clock_in_at: string;
  clock_out_at: string | null;
  session_date: string;
}

export default function AgentProjectsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    load();
  }, [user, token, router]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [projRes, sessRes] = await Promise.all([
        apiRequest<Project[]>("/project-sessions/projects", {}, token),
        apiRequest<Session[]>(`/project-sessions/me?date=${today}`, {}, token),
      ]);
      setProjects(Array.isArray(projRes) ? projRes : []);
      setSessions(Array.isArray(sessRes) ? sessRes : []);
    } catch {
      setProjects([]);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  const activeSession = sessions.find((s) => !s.clock_out_at);

  async function clockIn(projectId: string) {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/project-sessions/clock-in", { method: "POST", body: JSON.stringify({ projectId }) }, token);
      load();
    } catch (err: any) {
      setError((err as Error)?.message || "Clock-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function clockOut() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/project-sessions/clock-out", { method: "POST", body: JSON.stringify({}) }, token);
      load();
    } catch (err: any) {
      setError((err as Error)?.message || "Clock-out failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">My Projects</h1>
      <p className="text-slate-400">Log into one project at a time. Your current session for today is shown below.</p>
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}

      {activeSession && (
        <div className="card border-brand/30 bg-brand/5">
          <h2 className="mb-2 text-lg font-medium text-slate-50">Current project (today)</h2>
          <p className="text-slate-300">{activeSession.project_name} — clocked in at {new Date(activeSession.clock_in_at).toLocaleTimeString()}</p>
          <button type="button" onClick={clockOut} className="btn-primary mt-3" disabled={submitting}>
            {submitting ? "Logging out…" : "Log out of project"}
          </button>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-lg font-medium text-slate-50">Available projects</h2>
        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <div>
                  <p className="font-medium text-slate-50">{p.name}</p>
                  {p.description && <p className="text-sm text-slate-400">{p.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => clockIn(p.id)}
                  disabled={!!activeSession || submitting}
                  className="btn-primary shrink-0"
                >
                  {activeSession?.project_id === p.id ? "Current" : activeSession ? "One at a time" : "Log into project"}
                </button>
              </li>
            ))}
            {projects.length === 0 && <p className="text-slate-500">No projects available.</p>}
          </ul>
        )}
      </div>

      {sessions.filter((s) => s.clock_out_at).length > 0 && (
        <div className="card">
          <h2 className="mb-2 text-lg font-medium text-slate-50">Today sessions</h2>
          <ul className="text-sm text-slate-400">
            {sessions.filter((s) => s.clock_out_at).map((s) => (
              <li key={s.id}>
                {s.project_name}: {new Date(s.clock_in_at).toLocaleTimeString()} – {new Date(s.clock_out_at!).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
