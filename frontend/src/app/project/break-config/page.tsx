"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface BreakConfig {
  break_label: string;
  duration_minutes: number;
  sort_order: number;
}

export default function ProjectBreakConfigPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const projectName = searchParams.get("name") || "Project";
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [configs, setConfigs] = useState<BreakConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = typeof window !== "undefined" ? (() => { try { const raw = localStorage.getItem("konecta_auth"); return raw ? (JSON.parse(raw) as { token?: string }).token ?? null : null; } catch { return null; } })() : null;
    const authToken = token ?? storedToken;
    if (!authToken) {
      if (typeof window !== "undefined") router.replace("/login");
      return;
    }
    if (!user && storedToken) return; // wait for hydrate to set user
    if (!user) return;
    if (!projectId) {
      router.replace(user.role === "admin" ? "/admin/projects" : "/project-manager/dashboard");
      return;
    }
    apiRequest<BreakConfig[]>(`/break-config/project/${projectId}`, {}, authToken)
      .then(setConfigs)
      .catch(() => setConfigs([]))
      .finally(() => setLoading(false));
  }, [user, token, projectId, router]);

  function addRow() {
    setConfigs((c) => [...c, { break_label: "break", duration_minutes: 15, sort_order: c.length }]);
  }

  function removeRow(i: number) {
    setConfigs((c) => c.filter((_, j) => j !== i));
  }

  function updateRow(i: number, field: keyof BreakConfig, value: string | number) {
    setConfigs((c) => c.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !projectId) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = configs.map((r, i) => ({ break_label: r.break_label, duration_minutes: r.duration_minutes, sort_order: i }));
      await apiRequest(`/break-config/project/${projectId}`, { method: "PUT", body: JSON.stringify(payload) }, token);
    } catch (e: any) {
      setError((e as Error)?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Break configuration — {decodeURIComponent(projectName)}</h1>
      <p className="text-slate-400">Set allowed break types and durations (e.g. first break 15 min, lunch 30 min, last break 15 min). Used for validation and display.</p>
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="card">
          <form onSubmit={save}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-50">Break rules</h2>
              <button type="button" onClick={addRow} className="btn-secondary text-sm">Add break</button>
            </div>
            {configs.length === 0 ? (
              <p className="text-slate-500 text-sm">No breaks defined. Add one (e.g. first_break 15, lunch 30, last_break 15).</p>
            ) : (
              <ul className="space-y-3">
                {configs.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-4 rounded border border-slate-700 bg-slate-800/50 p-3">
                    <input
                      type="text"
                      className="input-field w-40"
                      placeholder="Label (e.g. first_break)"
                      value={r.break_label}
                      onChange={(e) => updateRow(i, "break_label", e.target.value)}
                    />
                    <input
                      type="number"
                      min={1}
                      max={120}
                      className="input-field w-24"
                      placeholder="Minutes"
                      value={r.duration_minutes}
                      onChange={(e) => updateRow(i, "duration_minutes", parseInt(e.target.value, 10) || 15)}
                    />
                    <span className="text-slate-400 text-sm">minutes</span>
                    <button type="button" onClick={() => removeRow(i)} className="text-red-400 hover:underline text-sm">Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => router.back()} className="btn-secondary">Back</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
