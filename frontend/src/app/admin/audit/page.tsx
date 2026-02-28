"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface AuditItem {
  id: string;
  action: string;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  timestamp: string;
}

export default function AdminAuditPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    setLoading(true);
    apiRequest<{ items: AuditItem[]; total: number }>(
      `/admin/audit?limit=${limit}&offset=${page * limit}`,
      {},
      token,
    )
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token, user?.role, page]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Audit Logs</h1>
      <div className="card overflow-auto">
        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : (
          <>
            <table className="data-table w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="p-2">Time</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">User ID</th>
                  <th className="p-2">Metadata</th>
                  <th className="p-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800">
                    <td className="p-2 text-slate-300">
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="p-2 font-mono text-slate-200">{row.action}</td>
                    <td className="p-2 font-mono text-slate-400">{row.user_id || "—"}</td>
                    <td className="max-w-xs truncate p-2 text-slate-500">
                      {row.metadata ? JSON.stringify(row.metadata) : "—"}
                    </td>
                    <td className="p-2 text-slate-500">{row.ip || "—"}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">
                      No audit entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {total > limit && (
              <div className="mt-4 flex items-center gap-4 text-sm text-slate-400">
                <span>
                  {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-outline text-xs"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="btn-outline text-xs"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
