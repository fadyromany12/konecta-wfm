"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../lib/api";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification link. Check your email for the full link.");
      return;
    }
    apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus("success");
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err?.message || "Verification failed. The link may have expired.");
      });
  }, [searchParams]);

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="card w-full max-w-md border-brand/20 text-center shadow-2xl shadow-black/30">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-brand/30" />
            <h1 className="text-xl font-bold text-white">Verifying your email…</h1>
            <p className="mt-2 text-slate-400">Please wait.</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold text-white">Email verified</h1>
            <p className="mt-2 text-slate-400">
              Your account is active. You can sign in now.
            </p>
            <Link href="/login" className="btn-primary mt-6 inline-block">
              Sign in
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold text-white">Verification failed</h1>
            <p className="mt-2 text-slate-400">{message}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/login" className="btn-primary">
                Sign in
              </Link>
              <Link href="/register" className="text-sm text-brand-light hover:underline">
                Register again
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
