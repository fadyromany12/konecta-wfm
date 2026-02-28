"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";
import { toast } from "../../../lib/toast";
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
  const [tab, setTab] = useState<"leave" | "swaps">("leave");
  const [leave, setLeave] = useState<LeaveItem[]>([]);
  const [swaps, setSwaps] = useState<SwapItem[]>([]);
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
      const [l, s] = await Promise.all([
        apiRequest<LeaveItem[]>("/manager/leave/pending", {}, token),
        apiRequest<SwapItem[]>("/shift-swaps/manager/pending", {}, token),
      ]);
      setLeave(l);
      setSwaps(s);
    } catch {
      setLeave([]);
      setSwaps([]);
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
      <div className="flex gap-2 border-b border-slate-700/80 pb-4">
        <button
          type="button"
          onClick={() => setTab("leave")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "leave"
              ? "bg-brand text-white shadow-lg shadow-brand/25"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          Leave ({leave.length})
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
                  <td className="p-2 capitalize">{r.type.replace("_", " ")}</td>
                  <td className="p-2">{r.start_date} → {r.end_date}</td>
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
