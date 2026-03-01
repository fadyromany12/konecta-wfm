"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ManagerOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface TransferRequest {
  id: string;
  agent_id: string;
  from_manager_id: string;
  to_manager_id: string;
  status: string;
  agent_first_name: string;
  agent_last_name: string;
  from_manager_first_name: string;
  from_manager_last_name: string;
  to_manager_first_name: string;
  to_manager_last_name: string;
  created_at: string;
}

export default function ManagerTransfersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [managersList, setManagersList] = useState<ManagerOption[]>([]);
  const [myRequests, setMyRequests] = useState<TransferRequest[]>([]);
  const [pendingApproval, setPendingApproval] = useState<TransferRequest[]>([]);
  const [allTransfers, setAllTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"transfer" | "mine" | "approve" | "history">("transfer");
  const [agentId, setAgentId] = useState("");
  const [toManagerId, setToManagerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "manager" && user.role !== "admin") {
      router.replace("/");
      return;
    }
    load();
  }, [user, token, router]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [teamRes, managersRes, mineRes, pendingRes, allRes] = await Promise.all([
        user.role === "manager" ? apiRequest<TeamMember[]>("/manager/team", {}, token) : Promise.resolve([]),
        apiRequest<ManagerOption[]>("/manager/managers-list", {}, token),
        apiRequest<TransferRequest[]>("/manager/transfer-requests?filter=mine", {}, token),
        apiRequest<TransferRequest[]>("/manager/transfer-requests?filter=pending_approval", {}, token),
        apiRequest<TransferRequest[]>("/manager/transfer-requests?filter=all", {}, token),
      ]);
      setTeam(Array.isArray(teamRes) ? teamRes : []);
      setManagersList(Array.isArray(managersRes) ? managersRes : []);
      setMyRequests(Array.isArray(mineRes) ? mineRes : []);
      setPendingApproval(Array.isArray(pendingRes) ? pendingRes : []);
      setAllTransfers(Array.isArray(allRes) ? allRes : []);
    } catch {
      setTeam([]);
      setManagersList([]);
      setMyRequests([]);
      setPendingApproval([]);
      setAllTransfers([]);
    } finally {
      setLoading(false);
    }
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !agentId || !toManagerId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest("/manager/transfer-request", {
        method: "POST",
        body: JSON.stringify({ agentId, toManagerId }),
      }, token);
      setSuccess("Transfer request submitted. It will be approved by your manager or admin.");
      setAgentId("");
      setToManagerId("");
      load();
    } catch (err: any) {
      setError(err?.message || "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function approve(id: string) {
    if (!token) return;
    try {
      await apiRequest(`/manager/transfer-requests/${id}/approve`, { method: "PATCH" }, token);
      load();
    } catch (err: any) {
      setError(err?.message || "Approve failed");
    }
  }

  async function reject(id: string) {
    if (!token) return;
    try {
      await apiRequest(`/manager/transfer-requests/${id}/reject`, { method: "PATCH" }, token);
      load();
    } catch (err: any) {
      setError(err?.message || "Reject failed");
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Reporting Line & Transfers</h1>
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}
      {success && <p className="rounded-lg bg-emerald-500/15 px-4 py-2 text-sm text-emerald-400">{success}</p>}

      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <button
          type="button"
          onClick={() => setTab("transfer")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "transfer" ? "bg-brand/20 text-brand-light" : "text-slate-400 hover:text-slate-200"}`}
        >
          Transfer agent
        </button>
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "mine" ? "bg-brand/20 text-brand-light" : "text-slate-400 hover:text-slate-200"}`}
        >
          My requests
        </button>
        <button
          type="button"
          onClick={() => setTab("approve")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "approve" ? "bg-brand/20 text-brand-light" : "text-slate-400 hover:text-slate-200"}`}
        >
          Pending my approval ({pendingApproval.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "history" ? "bg-brand/20 text-brand-light" : "text-slate-400 hover:text-slate-200"}`}
        >
          History
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : tab === "transfer" ? (
        <div className="card max-w-lg">
          <h2 className="mb-4 text-lg font-medium text-slate-50">Request transfer</h2>
          {user.role === "manager" && team.length === 0 ? (
            <p className="text-slate-400">You have no direct reports to transfer.</p>
          ) : (
            <form onSubmit={submitTransfer} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">Agent (your report)</label>
                <select
                  className="input-field w-full"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  required
                >
                  <option value="">Select agent…</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">New manager</label>
                <select
                  className="input-field w-full"
                  value={toManagerId}
                  onChange={(e) => setToManagerId(e.target.value)}
                  required
                >
                  <option value="">Select new manager…</option>
                  {managersList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit transfer request"}
              </button>
            </form>
          )}
        </div>
      ) : tab === "history" ? (
        <div className="card overflow-auto">
          <h2 className="mb-4 text-lg font-medium text-slate-50">Transfer history (all requests you approved or rejected)</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Agent</th>
                <th className="p-2">From → To manager</th>
                <th className="p-2">Status</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {allTransfers.map((r) => (
                <tr key={r.id} className="border-b border-slate-800">
                  <td className="p-2 text-slate-50">{r.agent_first_name} {r.agent_last_name}</td>
                  <td className="p-2 text-slate-300">{r.from_manager_first_name} {r.from_manager_last_name} → {r.to_manager_first_name} {r.to_manager_last_name}</td>
                  <td className="p-2 capitalize text-slate-300">{r.status}</td>
                  <td className="p-2 text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {allTransfers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">No transfer history.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === "mine" ? (
        <div className="card overflow-auto">
          <h2 className="mb-4 text-lg font-medium text-slate-50">My transfer requests</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Agent</th>
                <th className="p-2">From → To manager</th>
                <th className="p-2">Status</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((r) => (
                <tr key={r.id} className="border-b border-slate-800">
                  <td className="p-2 text-slate-50">{r.agent_first_name} {r.agent_last_name}</td>
                  <td className="p-2 text-slate-300">{r.from_manager_first_name} {r.from_manager_last_name} → {r.to_manager_first_name} {r.to_manager_last_name}</td>
                  <td className="p-2 capitalize text-slate-300">{r.status}</td>
                  <td className="p-2 text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {myRequests.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">No requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-auto">
          <h2 className="mb-4 text-lg font-medium text-slate-50">Pending your approval</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Agent</th>
                <th className="p-2">From → To manager</th>
                <th className="p-2">Date</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingApproval.map((r) => (
                <tr key={r.id} className="border-b border-slate-800">
                  <td className="p-2 text-slate-50">{r.agent_first_name} {r.agent_last_name}</td>
                  <td className="p-2 text-slate-300">{r.from_manager_first_name} {r.from_manager_last_name} → {r.to_manager_first_name} {r.to_manager_last_name}</td>
                  <td className="p-2 text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-2">
                    <button type="button" onClick={() => approve(r.id)} className="mr-2 text-emerald-400 hover:underline">Approve</button>
                    <button type="button" onClick={() => reject(r.id)} className="text-red-400 hover:underline">Reject</button>
                  </td>
                </tr>
              ))}
              {pendingApproval.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">No pending requests.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
