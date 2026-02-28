"use client";

import Link from "next/link";
import { useAuthStore } from "../../lib/authStore";

export default function PendingPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="card w-full max-w-md border-amber-500/20 text-center shadow-2xl shadow-black/30">
        <h1 className="text-2xl font-bold tracking-tight text-white">Account pending approval</h1>
        <p className="mt-4 text-slate-400">
          Your manager and admin have been notified. Once one of them approves your account, they will give you a <strong className="text-slate-200">temporary password</strong>.
        </p>
        <p className="mt-2 text-slate-400">
          After you log in with that password, go to <strong className="text-slate-200">Profile</strong> and set your own password.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/" className="btn-outline inline-block">
            Back to home
          </Link>
          <button
            type="button"
            onClick={() => {
              useAuthStore.getState().clearAuth();
              window.location.href = "/login";
            }}
            className="text-sm text-slate-500 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
