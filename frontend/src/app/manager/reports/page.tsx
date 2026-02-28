"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import Link from "next/link";

export default function ManagerReportsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "manager") router.replace("/");
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Reports</h1>
      <div className="card max-w-md">
        <p className="text-slate-400">
          Team attendance and performance reports. Use the Team Dashboard for daily attendance and Approvals for pending requests.
        </p>
        <Link href="/manager/dashboard" className="mt-4 inline-block text-violet-400 hover:underline">
          → Team Dashboard
        </Link>
      </div>
    </div>
  );
}
