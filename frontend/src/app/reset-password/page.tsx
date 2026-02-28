"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token") || "";
    setToken(t);
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!token.trim()) {
      setError("Reset link is invalid or expired. Request a new link from the forgot password page.");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4">
        <div className="card w-full max-w-md border-brand/20 text-center shadow-2xl shadow-black/30">
          <h1 className="text-2xl font-bold tracking-tight text-white">Password reset</h1>
          <p className="mb-6 text-slate-400">You can sign in with your new password.</p>
          <Link href="/login" className="btn-primary inline-block">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="card w-full max-w-md border-brand/20 shadow-2xl shadow-black/30">
        <h1 className="text-2xl font-bold tracking-tight text-white">Set new password</h1>
        <p className="mt-2 mb-6 text-slate-400">
          Enter your new password below. Use the link from your email or paste the token.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          {!searchParams.get("token") && (
            <div>
              <label className="mb-1 block text-sm text-slate-300">Reset token</label>
              <input
                type="text"
                className="input-field w-full"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from email"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-slate-300">New password</label>
            <input
              type="password"
              className="input-field w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Resetting..." : "Reset password"}
          </button>
          <p className="text-center text-sm text-slate-500">
            <Link href="/forgot-password" className="text-brand-light hover:underline">
              Request new link
            </Link>
            {" · "}
            <Link href="/login" className="text-brand-light hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
