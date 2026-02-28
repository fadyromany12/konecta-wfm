"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api";

interface ForgotResponse {
  message: string;
  resetToken?: string;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<ForgotResponse>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSent(true);
      if (res.resetToken) setDevToken(res.resetToken);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4">
        <div className="card w-full max-w-md border-brand/20 text-center shadow-2xl shadow-black/30">
          <h1 className="text-2xl font-bold tracking-tight text-white">Check your email</h1>
          <p className="mb-6 text-slate-400">
            If an account exists for <strong className="text-slate-200">{email}</strong>, we sent a password reset link.
          </p>
          {devToken && (
            <p className="mb-4 rounded bg-slate-800 p-3 text-left text-xs text-slate-400">
              Dev: use this token on the reset page: <code className="break-all text-amber-300">{devToken}</code>
            </p>
          )}
          <Link href="/login" className="btn-primary inline-block">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="card w-full max-w-md border-brand/20 shadow-2xl shadow-black/30">
        <h1 className="text-2xl font-bold tracking-tight text-white">Forgot password</h1>
        <p className="mt-2 mb-6 text-slate-400">
          Enter your Konecta email and we’ll send a reset link.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              className="input-field w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@konecta.com"
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="text-brand-light hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
