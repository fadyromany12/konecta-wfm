"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { safeLabel, formatDateOnly } from "../../../lib/format";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { TableSkeleton } from "../../../components/ui/Skeleton";

interface LeaveItem {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
}

interface SwapItem {
  id: string;
  requester_id: string;
  target_id: string;
  date: string;
  reason: string | null;
  requester_status: string;
  manager_approval: string;
}

export default function ManagerApprovalsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<"leave" | "swaps" | "leaveHistory" | "swapsHistory">("leave");
  const [leave, setLeave] = useState<LeaveItem[]>([]);
  const [swaps, setSwaps] = useState<SwapItem[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<LeaveItem[]>([]);
  const [swapHistory, setSwapHistory] = useState<SwapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectLeaveId, setRejectLeaveId] = useState<string | null>(null);
  const [rejectSwapId, setRejectSwapId] = useState<string | null>(null);

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
  }, [user, token]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [l, s, teamLeave, teamSwaps] = await Promise.all([
        apiRequest<LeaveItem[] | { data?: LeaveItem[] }>("/manager/leave/pending", {}, token),
        apiRequest<SwapItem[] | { data?: SwapItem[] }>("/shift-swaps/manager/pending", {}, token),
        apiRequest<LeaveItem[] | { data?: LeaveItem[] }>("/manager/leave/team", {}, token),
        apiRequest<SwapItem[] | { data?: SwapItem[] }>("/shift-swaps/manager/team", {}, token),
      ]);
      const leaveList = Array.isArray(l) ? l : (l as { data?: LeaveItem[] })?.data ?? [];
      const swapList = Array.isArray(s) ? s : (s as { data?: SwapItem[] })?.data ?? [];
      const teamLeaveList = Array.isArray(teamLeave) ? teamLeave : (teamLeave as { data?: LeaveItem[] })?.data ?? [];
      const teamSwapList = Array.isArray(teamSwaps) ? teamSwaps : (teamSwaps as { data?: SwapItem[] })?.data ?? [];
      setLeave(leaveList);
      setSwaps(swapList);
      setLeaveHistory((teamLeaveList || []).filter((r) => r.status !== "pending"));
      setSwapHistory((teamSwapList || []).filter((sw) => sw.manager_approval !== "pending"));
    } catch {
      setLeave([]);
      setSwaps([]);
      setLeaveHistory([]);
      setSwapHistory([]);
    } finally {
      setLoading(false);
    }
  }

  async function approveLeave(id: string) {
    if (!token) return;
    try {
      await apiRequest(`/manager/leave/${id}/approve`, { method: "POST" }, token);
      await load();
      toast.success("Leave request approved");
    } catch {
      toast.error("Failed to approve");
    }
  }

  async function rejectLeave(id: string) {
    if (!token) return;
    try {
      await apiRequest(`/manager/leave/${id}/reject`, { method: "POST" }, token);
      setRejectLeaveId(null);
      await load();
      toast.success("Leave request rejected");
    } catch {
      toast.error("Failed to reject");
    }
  }

  async function approveSwap(id: string, approve: boolean) {
    if (!token) return;
    try {
      await apiRequest(`/shift-swaps/${id}/manager-approve`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      }, token);
      setRejectSwapId(null);
      await load();
      toast.success(approve ? "Swap approved" : "Swap rejected");
    } catch {
      toast.error("Action failed");
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Pending Approvals</h1>
        <p className="page-subtitle">Review and approve leave requests and shift swaps</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-700/80 pb-4">
        <button
          type="button"
          onClick={() => setTab("leave")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "leave"
              ? "bg-brand text-white shadow-lg shadow-brand/25"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          Leave pending ({leave.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("leaveHistory")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "leaveHistory"
              ? "bg-brand text-white shadow-lg shadow-brand/25"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          Leave history
        </button>
        <button
          type="button"
          onClick={() => setTab("swaps")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "swaps"
              ? "bg-brand text-white shadow-lg shadow-brand/25"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          Shift swaps ({swaps.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("swapsHistory")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "swapsHistory"
              ? "bg-brand text-white shadow-lg shadow-brand/25"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          Swap history
        </button>
      </div>

      <ConfirmDialog
        open={!!rejectLeaveId}
        title="Reject leave request"
        message="The agent will be notified. You can't undo this."
        confirmLabel="Reject"
        variant="danger"
        onConfirm={() => rejectLeaveId && rejectLeave(rejectLeaveId)}
        onCancel={() => setRejectLeaveId(null)}
      />
      <ConfirmDialog
        open={!!rejectSwapId}
        title="Reject shift swap"
        message="The request will be declined. You can't undo this."
        confirmLabel="Reject"
        variant="danger"
        onConfirm={() => rejectSwapId && approveSwap(rejectSwapId, false)}
        onCancel={() => setRejectSwapId(null)}
      />

      {loading ? (
        <div className="card">
          <TableSkeleton rows={4} cols={5} />
        </div>
      ) : tab === "leaveHistory" ? (
        <div className="card overflow-auto">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Leave history (approved / rejected)</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Agent</th>
                <th className="p-2">Type</th>
                <th className="p-2">Dates</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {leaveHistory.map((r) => (
                <tr key={r.id} className="border-b border-slate-800">
                  <td className="p-2">{r.first_name} {r.last_name}</td>
                  <td className="p-2 capitalize">{safeLabel(r.type)}</td>
                  <td className="p-2">{formatDateOnly(r.start_date)} → {formatDateOnly(r.end_date)}</td>
                  <td className="p-2 max-w-xs truncate">{r.reason || "-"}</td>
                  <td className="p-2 capitalize">{r.status}</td>
                </tr>
              ))}
              {leaveHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">No leave history yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === "swapsHistory" ? (
        <div className="card overflow-auto">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Swap history (approved / rejected)</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Date</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Your decision</th>
              </tr>
            </thead>
            <tbody>
              {swapHistory.map((s) => (
                <tr key={s.id} className="border-b border-slate-800">
                  <td className="p-2">{s.date}</td>
                  <td className="p-2 max-w-xs truncate">{s.reason || "-"}</td>
                  <td className="p-2 capitalize">{s.manager_approval === "approved" ? "Approved" : s.manager_approval === "rejected" ? "Rejected" : s.manager_approval || "-"}</td>
                </tr>
              ))}
              {swapHistory.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">No swap history yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === "leave" ? (
        <div className="card overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Agent</th>
                <th className="p-2">Type</th>
                <th className="p-2">Dates</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leave.map((r) => (
                <tr key={r.id} className="border-b border-slate-800">
                  <td className="p-2">{r.first_name} {r.last_name}</td>
                  <td className="p-2 capitalize">{safeLabel(r.type)}</td>
                  <td className="p-2">{formatDateOnly(r.start_date)} → {formatDateOnly(r.end_date)}</td>
                  <td className="p-2 max-w-xs truncate">{r.reason || "-"}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => approveLeave(r.id)}
                      className="mr-2 text-green-400 hover:underline"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectLeaveId(r.id)}
                      className="text-red-400 transition-colors hover:text-red-300"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {leave.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No pending leave requests. All caught up.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Date</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((s) => (
                <tr key={s.id} className="border-b border-slate-800">
                  <td className="p-2">{s.date}</td>
                  <td className="p-2">{s.reason || "-"}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => approveSwap(s.id, true)}
                      className="mr-2 text-green-400 hover:underline"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectSwapId(s.id)}
                      className="text-red-400 transition-colors hover:text-red-300"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {swaps.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    No pending shift swaps.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
