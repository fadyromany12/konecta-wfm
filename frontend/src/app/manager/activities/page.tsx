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

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Coachings and Meetings</h1>
      <p className="page-subtitle">View coachings and meetings for your team. Schedule activities are managed via the Schedule page.</p>
      <div className="card">
        <p className="text-[var(--text-muted)]">
          To add or edit shift activities (coaching, meeting, training), use the <strong>Schedule</strong> page for the relevant agent and date.
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Your team has {team.length} member{team.length !== 1 ? "s" : ""}. Use the Activity Grid to see current AUX and events.
        </p>
      </div>
    </div>
  );
}
