"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/authStore";
import { apiRequest } from "../../lib/api";
import { toast } from "../../lib/toast";

interface OpenShift {
  id: string;
  date: string;
  shift_start: string;
  shift_end: string;
  role_or_title: string | null;
  notes: string | null;
  status: string;
}

export default function ShiftBiddingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState<OpenShift[]>([]);
  const [myClaims, setMyClaims] = useState<OpenShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    load();
  }, [user, token]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [o, c] = await Promise.all([
        apiRequest<OpenShift[]>("/shift-bidding/open?from=" + from + "&to=" + to, {}, token),
        apiRequest<OpenShift[]>("/shift-bidding/my-claims?from=" + from + "&to=" + to, {}, token),
      ]);
      setOpen(Array.isArray(o) ? o : []);
      setMyClaims(Array.isArray(c) ? c : []);
    } catch {
      setOpen([]);
      setMyClaims([]);
    } finally {
      setLoading(false);
    }
  }

  async function claim(id: string) {
    if (!token) return;
    try {
      await apiRequest("/shift-bidding/open/" + id + "/claim", { method: "POST" }, token);
      toast.success("Shift claimed");
      load();
    } catch {
      toast.error("Failed to claim");
    }
  }

  async function postShift(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !user || (user.role !== "manager" && user.role !== "admin")) return;
    const form = e.currentTarget;
    const date = (form.querySelector('[name="date"]') as HTMLInputElement)?.value;
    const shift_start = (form.querySelector('[name="shift_start"]') as HTMLInputElement)?.value;
    const shift_end = (form.querySelector('[name="shift_end"]') as HTMLInputElement)?.value;
    if (!date || !shift_start || !shift_end) {
      toast.error("Date and times required");
      return;
    }
    setPosting(true);
    try {
      await apiRequest("/shift-bidding/post", {
        method: "POST",
        body: JSON.stringify({
          date,
          shift_start: date + "T" + shift_start + ":00",
          shift_end: date + "T" + shift_end + ":00",
        }),
      }, token);
      toast.success("Shift posted");
      load();
      form.reset();
    } catch {
      toast.error("Failed to post");
    } finally {
      setPosting(false);
    }
  }

  if (!user) return null;

  const canPost = user.role === "manager" || user.role === "admin";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Shift Bidding</h1>

      {canPost && (
        <div className="card p-4">
          <h2 className="text-lg font-medium text-slate-200 mb-3">Post open shift</h2>
          <form onSubmit={postShift} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm text-slate-400">Date</label>
              <input name="date" type="date" required className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-slate-400">Start</label>
              <input name="shift_start" type="time" required className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-slate-400">End</label>
              <input name="shift_end" type="time" required className="input-field" />
            </div>
            <button type="submit" disabled={posting} className="btn-primary">Post</button>
          </form>
        </div>
      )}

      <div className="card overflow-auto">
        <h2 className="text-lg font-medium text-slate-200 p-4 border-b border-slate-700">Open shifts</h2>
        {loading ? (
          <p className="p-4 text-slate-400">Loading…</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Date</th>
                <th className="p-2">Time</th>
                <th className="p-2">Role</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {open.map((s) => (
                <tr key={s.id} className="border-b border-slate-800">
                  <td className="p-2 text-slate-300">{s.date}</td>
                  <td className="p-2 text-slate-300">
                    {new Date(s.shift_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {new Date(s.shift_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="p-2 text-slate-300">{s.role_or_title || "—"}</td>
                  <td className="p-2">
                    {!canPost && (
                      <button type="button" onClick={() => claim(s.id)} className="text-brand-400 hover:underline">Claim</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && open.length === 0 && <p className="p-4 text-slate-400">No open shifts.</p>}
      </div>

      <div className="card overflow-auto">
        <h2 className="text-lg font-medium text-slate-200 p-4 border-b border-slate-700">My claimed shifts</h2>
        {loading ? (
          <p className="p-4 text-slate-400">Loading…</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Date</th>
                <th className="p-2">Time</th>
                <th className="p-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {myClaims.map((s) => (
                <tr key={s.id} className="border-b border-slate-800">
                  <td className="p-2 text-slate-300">{s.date}</td>
                  <td className="p-2 text-slate-300">
                    {new Date(s.shift_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {new Date(s.shift_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="p-2 text-slate-300">{s.role_or_title || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && myClaims.length === 0 && <p className="p-4 text-slate-400">No claimed shifts.</p>}
      </div>
    </div>
  );
}
