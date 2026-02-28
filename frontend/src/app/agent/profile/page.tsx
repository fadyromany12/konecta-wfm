"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";

export default function AgentProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Profile</h1>
      <div className="card max-w-md">
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-slate-500">Name</dt>
            <dd className="text-slate-100">
              {user.first_name} {user.last_name}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="text-slate-100">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Role</dt>
            <dd className="capitalize text-slate-100">{user.role}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
