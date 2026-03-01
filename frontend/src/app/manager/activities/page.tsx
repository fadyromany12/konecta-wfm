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

export default function ManagerActivitiesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"coaching" | "meeting" | "training">("meeting");
  const [startAt, setStartAt] = useState("09:00");
  const [endAt, setEndAt] = useState("09:30");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "manager") {
      router.replace("/");
      return;
    }
    apiRequest<TeamMember[]>("/manager/team", {}, token).then(setTeam).catch(() => setTeam([]));
  }, [user, token, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !userId) return;
    const start = `${activityDate}T${startAt}:00`;
    const end = `${activityDate}T${endAt}:00`;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest("/manager/schedule-activities", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, activity_date: activityDate, type, start_at: start, end_at: end, title: title || null, notes: notes || null }),
      }, token);
      setSuccess("Coaching/meeting added.");
      setShowForm(false);
    } catch (e: any) {
      setError((e as Error)?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Coachings and Meetings</h1>
      <p className="text-slate-400">Schedule a coaching or meeting for a team member.</p>
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}
      {success && <p className="rounded-lg bg-emerald-500/15 px-4 py-2 text-sm text-emerald-400">{success}</p>}
      <div className="card">
        <button type="button" onClick={() => setShowForm((s) => !s)} className="btn-primary">
          {showForm ? "Cancel" : "Add coaching or meeting"}
        </button>
        {showForm && (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Team member</label>
              <select className="input-field w-full" value={userId} onChange={(e) => setUserId(e.target.value)} required>
                <option value="">Select agent</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Date</label>
              <input type="date" className="input-field w-full" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Type</label>
              <select className="input-field w-full" value={type} onChange={(e) => setType(e.target.value as "coaching" | "meeting" | "training")}>
                <option value="coaching">Coaching</option>
                <option value="meeting">Meeting</option>
                <option value="training">Training</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">Start time</label>
                <input type="time" className="input-field w-full" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">End time</label>
                <input type="time" className="input-field w-full" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Title (optional)</label>
              <input type="text" className="input-field w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Adding..." : "Add"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
