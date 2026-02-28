"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "../../lib/authStore";
import { apiRequest } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const forceChange = searchParams.get("change") === "1";

  useEffect(() => {
    if (!user || !token) router.replace("/login");
  }, [user, token, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmNew) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      setError("New password must be at least 8 characters and include a number");
      return;
    }
    if (!token) return;
    setLoading(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      }, token);
      toast.success("Password updated. Use your new password next time you sign in.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
      if (forceChange) router.replace("/");
    } catch (err: any) {
      setError(err?.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
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

      <div className="card max-w-md">
        <h2 className="mb-4 text-lg font-medium text-slate-50">Change password</h2>
        {forceChange && (
          <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
            Please set your own password. You are currently using a temporary password.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Current password</label>
            <input
              type="password"
              className="input-field w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">New password</label>
            <input
              type="password"
              className="input-field w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="mt-1 text-xs text-slate-500">At least 8 characters, include a number</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Confirm new password</label>
            <input
              type="password"
              className="input-field w-full"
              value={confirmNew}
              onChange={(e) => setConfirmNew(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
