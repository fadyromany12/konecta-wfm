"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { downloadExport } from "../../../lib/api";
import { toast } from "../../../lib/toast";

const today = new Date();
const yyyy = (d: Date) => d.toISOString().slice(0, 10);
const presets = [
  { label: "Today", from: yyyy(today), to: yyyy(today) },
  {
    label: "This week",
    from: yyyy(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
    to: yyyy(today),
  },
  {
    label: "This month",
    from: yyyy(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: yyyy(today),
  },
  {
    label: "Last 30 days",
    from: yyyy(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
    to: yyyy(today),
  },
];

const defaultFrom = yyyy(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
const defaultTo = yyyy(today);

export default function AdminReportsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/");
  }, [user, router]);

  async function handleExport(type: "attendance" | "leave" | "aux" | "overtime" | "payroll") {
    if (!token) return;
    setError(null);
    setLoading(type);
    try {
      const path = type === "payroll" ? "/admin/payroll/export" : `/admin/export/${type}`;
      await downloadExport(path, `${type}-${from}-${to}.csv`, token, { from, to });
      toast.success("Download started");
    } catch (e) {
      const msg = (e as Error).message || "Export failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Exports</h1>
        <p className="page-subtitle">Download CSV reports for the selected date range</p>
      </div>
      <div className="card space-y-6 transition-shadow duration-300 hover:shadow-xl">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setFrom(p.from);
                  setTo(p.to);
                }}
                className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleExport("attendance")}
            disabled={!!loading}
            className="btn-outline"
          >
            {loading === "attendance" ? "Downloading…" : "Attendance CSV"}
          </button>
          <button
            type="button"
            onClick={() => handleExport("leave")}
            disabled={!!loading}
            className="btn-outline"
          >
            {loading === "leave" ? "Downloading…" : "Leave CSV"}
          </button>
          <button
            type="button"
            onClick={() => handleExport("aux")}
            disabled={!!loading}
            className="btn-outline"
          >
            {loading === "aux" ? "Downloading…" : "AUX CSV"}
          </button>
          <button
            type="button"
            onClick={() => handleExport("overtime")}
            disabled={!!loading}
            className="btn-outline"
          >
            {loading === "overtime" ? "Downloading…" : "Overtime CSV"}
          </button>
          <button
            type="button"
            onClick={() => handleExport("payroll")}
            disabled={!!loading}
            className="rounded-xl border border-emerald-600 bg-emerald-900/30 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-800/40"
          >
            {loading === "payroll" ? "Downloading…" : "Payroll Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
