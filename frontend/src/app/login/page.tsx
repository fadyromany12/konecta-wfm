"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../lib/api";
import { useAuthStore } from "../../lib/authStore";

interface LoginResponse {
  token: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: "agent" | "manager" | "admin";
  };
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuth(res.user, res.token);
      if (res.user.role === "agent") {
        router.push("/agent/dashboard");
      } else if (res.user.role === "manager") {
        router.push("/manager/dashboard");
      } else {
        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("fetch") || msg.includes("Network") || msg.includes("Failed to fetch")) {
        setError("Cannot connect to server. Start the backend: cd backend && npm run dev — then check http://localhost:4000/health");
      } else {
        setError(msg || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="card w-full max-w-md border-brand/20 shadow-2xl shadow-black/30">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Konecta WFM
          </h1>
          <p className="mt-2 text-slate-400">
            Sign in with your Konecta email to access your dashboard.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              className="input-field w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Password</label>
            <input
              type="password"
              className="input-field w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full py-3.5" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-sm text-slate-500">
            No account?{" "}
            <Link href="/register" className="font-medium text-brand-light hover:underline">
              Register
            </Link>
            {" · "}
            <Link href="/forgot-password" className="font-medium text-slate-400 hover:text-brand-light hover:underline">
              Forgot password?
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

