"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/authStore";
import { apiRequest } from "../../lib/api";

type ManagerAbove = { id: string; first_name: string; last_name: string; email: string; role: string; level: number };
type Colleague = { id: string; first_name: string; last_name: string; email: string; role: string };
type ReporteeNode = { id: string; first_name: string; last_name: string; email: string; role: string; reportees?: ReporteeNode[] };
type OrgViewData = { me: { id: string; first_name: string; last_name: string; email: string; role: string }; managersAbove: ManagerAbove[]; colleagues: Colleague[]; directReports?: Colleague[]; reporteesTree?: ReporteeNode[] };

export default function OrgViewPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<OrgViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) { router.replace("/login"); return; }
    (async () => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<OrgViewData | { data?: OrgViewData }>("/me/org-view", {}, token);
        const payload = res && typeof res === "object" && "data" in res ? (res as { data?: OrgViewData }).data : res;
        setData(payload && typeof payload === "object" ? (payload as OrgViewData) : null);
      } catch { setData(null); setError("Failed to load org view"); }
      finally { setLoading(false); }
    })();
  }, [user, token, router]);

  if (!user) return null;

  function ReporteeTree({ nodes, level = 0 }: { nodes: ReporteeNode[]; level?: number }) {
    if (!nodes?.length) return null;
    return (
      <ul className={level > 0 ? "mt-2 ml-4 space-y-2 border-l-2 border-slate-600/50 pl-4" : "space-y-2"}>
        {nodes.map((n) => (
          <li key={n.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <div>
              <p className="font-medium text-slate-50">{n.first_name} {n.last_name}</p>
              <p className="text-sm text-slate-400">{n.email} · {n.role}</p>
            </div>
            {n.reportees?.length ? <ReporteeTree nodes={n.reportees} level={level + 1} /> : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Org View</h1>
      <p className="text-slate-400">Managers above you, colleagues, and all your reportees (direct and indirect).</p>
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}
      {loading ? <p className="text-slate-400">Loading...</p> : data ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="card">
            <h2 className="mb-4 text-lg font-medium text-slate-50">Managers above you</h2>
            <ul className="space-y-3">
              {data.managersAbove.length === 0 ? <li className="text-slate-500">No manager in the system.</li> : data.managersAbove.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-sm font-medium text-brand-light">Level {m.level}</span>
                  <div>
                    <p className="font-medium text-slate-50">{m.first_name} {m.last_name}</p>
                    <p className="text-sm text-slate-400">{m.email} · {m.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h2 className="mb-4 text-lg font-medium text-slate-50">My team (colleagues)</h2>
            <p className="mb-2 text-sm text-slate-400">Same direct manager as you</p>
            <ul className="space-y-3">
              {data.colleagues.length === 0 ? <li className="text-slate-500">No colleagues in your team.</li> : data.colleagues.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <div>
                    <p className="font-medium text-slate-50">{c.first_name} {c.last_name}</p>
                    <p className="text-sm text-slate-400">{c.email} · {c.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {(data.directReports?.length ?? 0) > 0 && (
            <div className="card">
              <h2 className="mb-4 text-lg font-medium text-slate-50">My direct reports</h2>
              <p className="mb-2 text-sm text-slate-400">People who report to you</p>
              <ul className="space-y-3">
                {data.directReports!.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <div>
                      <p className="font-medium text-slate-50">{c.first_name} {c.last_name}</p>
                      <p className="text-sm text-slate-400">{c.email} · {c.role}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
      {data?.reporteesTree?.length ? (
        <div className="card">
          <h2 className="mb-4 text-lg font-medium text-slate-50">All my reportees</h2>
          <p className="mb-2 text-sm text-slate-400">Direct reports and their reportees (full tree)</p>
          <ReporteeTree nodes={data.reporteesTree} />
        </div>
      ) : null}
    </div>
  );
}
