"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { formatDateOnly } from "../../../lib/format";
import { TableSkeleton } from "../../../components/ui/Skeleton";

interface AnomalyRow {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: string | null;
  status: string;
  shift_date: string;
  first_name: string;
  last_name: string;
  email: string;
}

function formatClock(d: string) {
  try {
    const dt = new Date(d);
    return dt.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return d;
  }
}

export default function ManagerAnomaliesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveClockOut, setResolveClockOut] = useState("");

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "manager") {
      router.replace("/");
      return;
    }
    load();
  }, [user, token, router]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiRequest<AnomalyRow[]>("/manager/attendance/anomalies", {}, token);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function openResolve(row: AnomalyRow) {
    setResolvingId(row.id);
    // Default clock_out to end of shift_date (23:59) in local time
    const d = new Date(row.clock_in);
    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 0, 0);
    setResolveClockOut(endOfDay.toISOString().slice(0, 16));
  }

  async function submitResolve() {
    if (!token || !resolvingId || !resolveClockOut) return;
    try {
      await apiRequest(`/manager/attendance/${resolvingId}/resolve-anomaly`, {
        method: "PATCH",
        body: JSON.stringify({ clock_out: new Date(resolveClockOut).toISOString() }),
      }, token);
      setResolvingId(null);
      setResolveClockOut("");
      await load();
      toast.success("Anomaly resolved");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Resolve failed";
      toast.error(msg);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Timesheet Anomalies</h1>
      <p className="text-slate-400 text-sm">
        Open punches that were left overnight (e.g. forgot to clock out). Set a clock-out time to resolve and move the record back to active.
      </p>
      <div className="card overflow-auto">
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="p-2">Agent</th>
                  <th className="p-2">Shift date</th>
                  <th className="p-2">Clock in</th>
                  <th className="p-2">Clock out</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800">
                    <td className="p-2 text-slate-50">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="p-2 text-slate-300">{formatDateOnly(r.shift_date)}</td>
                    <td className="p-2 text-slate-300">{formatClock(r.clock_in)}</td>
                    <td className="p-2 text-slate-300">{r.clock_out ? formatClock(r.clock_out) : "—"}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => openResolve(r)}
                        className="text-brand-400 hover:underline"
                      >
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && !loading && (
              <p className="p-4 text-slate-400">No anomalies. All punches are resolved.</p>
            )}
          </>
        )}
      </div>

      {resolvingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setResolvingId(null)}>
          <div className="card w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-50 mb-4">Resolve anomaly</h2>
            <p className="text-slate-400 text-sm mb-4">Set the clock-out time for this punch. Total hours will be calculated automatically.</p>
            <label className="block text-sm text-slate-400 mb-1">Clock out</label>
            <input
              type="datetime-local"
              value={resolveClockOut}
              onChange={(e) => setResolveClockOut(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-50 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setResolvingId(null)}
                className="rounded bg-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitResolve}
                className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-500"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
