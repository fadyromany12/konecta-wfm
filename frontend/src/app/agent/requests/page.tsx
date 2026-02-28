"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest, apiUpload } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import EmptyState from "../../../components/ui/EmptyState";

interface LeaveRequest {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
}

const TYPES = ["annual", "sick", "casual", "overtime", "cancel_day_off"] as const;

export default function AgentRequestsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [list, setList] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<string>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [sickFile, setSickFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      const data = await apiRequest<LeaveRequest[]>("/leave/me", {}, token);
      setList(data);
    } catch {
      setList([]);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (type === "sick" && !sickFile) {
      setSubmitError("Sick leave requires a supporting document (PDF, DOC, or image).");
      return;
    }
    if (type === "overtime" && (!startTime || !endTime)) {
      setSubmitError("Overtime request requires start time and end time.");
      return;
    }
    setSubmitError(null);
    setLoading(true);
    try {
      let fileUrl: string | null = null;
      if (type === "sick" && sickFile) {
        const formData = new FormData();
        formData.append("file", sickFile);
        const up = await apiUpload("/upload", formData, token);
        fileUrl = up.file_url;
      }
      await apiRequest("/leave", {
        method: "POST",
        body: JSON.stringify({
          type,
          start_date: startDate,
          end_date: endDate,
          start_time: type === "overtime" ? startTime : null,
          end_time: type === "overtime" ? endTime : null,
          reason: reason || null,
          file_url: fileUrl,
        }),
      }, token);
      setShowForm(false);
      setType("annual");
      setStartDate("");
      setEndDate("");
      setReason("");
      setStartTime("");
      setEndTime("");
      setSickFile(null);
      await load();
      toast.success("Leave request submitted");
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to submit");
      toast.error(err?.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">My Leave Requests</h1>
          <p className="page-subtitle">{list.length} request{list.length !== 1 ? "s" : ""}</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary shrink-0">
          {showForm ? "Cancel" : "New Request"}
        </button>
      </div>

      {showForm && (
        <div className="card animate-slide-up">
          <h2 className="mb-4 text-lg font-medium text-slate-200">New leave request</h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-slate-400">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                />
              </div>
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
            {type === "overtime" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Start time (required)</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">End time (required)</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
              </div>
            )}
            {type === "sick" && (
              <div>
                <label className="mb-1 block text-sm text-slate-400">Supporting document (required for sick leave)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
                  onChange={(e) => setSickFile(e.target.files?.[0] || null)}
                />
                <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX, JPG or PNG, max 10MB</p>
              </div>
            )}
            {submitError && <p className="text-sm text-red-400">{submitError}</p>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Submitting..." : "Submit"}
            </button>
          </form>
        </div>
      )}

      <div className="card overflow-auto transition-shadow duration-300 hover:shadow-xl">
        {list.length === 0 && !showForm ? (
          <EmptyState
            icon="leave"
            title="No leave requests yet"
            description="Submit a new request when you need time off or overtime."
            action={
              <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
                New Request
              </button>
            }
          />
        ) : (
        <table className="data-table w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="p-2">Type</th>
              <th className="p-2">Start</th>
              <th className="p-2">End</th>
              <th className="p-2">Status</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-slate-800">
                <td className="p-2 capitalize">{r.type.replace("_", " ")}</td>
                <td className="p-2">{r.start_date}</td>
                <td className="p-2">{r.end_date}</td>
                <td className="p-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      r.status === "approved"
                        ? "bg-green-900/50 text-green-300"
                        : r.status === "rejected"
                          ? "bg-red-900/50 text-red-300"
                          : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-500">
                  No leave requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
