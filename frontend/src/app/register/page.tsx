"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api";

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [managerId, setManagerId] = useState<string>("");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiRequest<Manager[]>("/auth/managers", {})
      .then(setManagers)
      .catch(() => setManagers([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!managerId.trim()) {
      setError("Please select your manager");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
          managerId: managerId.trim() || null,
        }),
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.message || "";
      setError(msg.includes("Email already") ? msg : msg || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4">
        <div className="card w-full max-w-md border-brand/20 text-center shadow-2xl shadow-black/30">
          <h1 className="text-2xl font-bold tracking-tight text-white">Registration submitted</h1>
          <p className="mb-6 text-slate-400">
            Your manager and admin will approve your account. You can log in to see your status. Once approved, your manager will give you a temporary password—then change it in Profile.
          </p>
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
        <h1 className="text-2xl font-bold tracking-tight text-white">Create account</h1>
        <p className="mt-2 mb-6 text-slate-400">
          Use your Konecta email (@konecta.com) to register.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">First name</label>
              <input
                type="text"
                className="input-field w-full"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Last name</label>
              <input
                type="text"
                className="input-field w-full"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
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
          <div>
            <label className="mb-1 block text-sm text-slate-300">Your manager</label>
            <select
              className="input-field w-full"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              required
            >
              <option value="">Select manager…</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Password</label>
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
            <label className="mb-1 block text-sm text-slate-300">Confirm password</label>
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
            {loading ? "Creating account..." : "Register"}
          </button>
          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-light hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
