"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface ShiftSwap {
  id: string;
  requester_id: string;
  target_id: string;
  date: string;
  reason: string | null;
  requester_status: string;
  manager_approval: string;
  status: string;
  created_at: string;
}

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function AgentSwapPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "agent") {
      router.replace("/");
      return;
    }
    load();
  }, [user, token]);

  async function load() {
    if (!token) return;
    try {
      const [s, a] = await Promise.all([
        apiRequest<ShiftSwap[]>("/shift-swaps/me", {}, token),
        apiRequest<Agent[]>("/users/agents", {}, token),
      ]);
      setSwaps(s);
      setAgents(a);
    } catch {
      setSwaps([]);
      setAgents([]);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !targetId || !date) return;
    setError(null);
    setLoading(true);
    try {
      await apiRequest("/shift-swaps", {
        method: "POST",
        body: JSON.stringify({ target_id: targetId, date, reason: reason || null }),
      }, token);
      setShowForm(false);
      setTargetId("");
      setDate("");
      setReason("");
      await load();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function respond(id: string, accept: boolean) {
    if (!token) return;
    try {
      await apiRequest(`/shift-swaps/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      }, token);
      await load();
    } catch (err: any) {
      setError(err.message || "Failed");
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-50">Shift Swap</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? "Cancel" : "Request Swap"}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Swap with agent</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              >
                <option value="">Select agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.first_name} {a.last_name} ({a.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Submitting..." : "Submit"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 text-lg font-medium text-slate-200">My swap requests</h2>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Date</th>
                <th className="p-2">Target / Requester</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((s) => {
                const isTarget = s.target_id === user.id;
                const isRequester = s.requester_id === user.id;
                const pendingTarget = isTarget && s.requester_status === "pending";
                return (
                  <tr key={s.id} className="border-b border-slate-800">
                    <td className="p-2">{s.date}</td>
                    <td className="p-2">
                      {isRequester ? "You → another" : "Another → you"}
                    </td>
                    <td className="p-2">
                      <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {s.status} / {s.requester_status} / {s.manager_approval}
                      </span>
                    </td>
                    <td className="p-2">
                      {pendingTarget && (
                        <>
                          <button
                            type="button"
                            onClick={() => respond(s.id, true)}
                            className="mr-2 text-green-400 hover:underline"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => respond(s.id, false)}
                            className="text-red-400 hover:underline"
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {swaps.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">
                    No shift swaps yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
