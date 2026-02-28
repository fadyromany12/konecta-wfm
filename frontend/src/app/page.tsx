"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "../lib/authStore";

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    } else if (user.role === "agent") {
      router.replace("/agent/dashboard");
    } else if (user.role === "manager") {
      router.replace("/manager/dashboard");
    } else if (user.role === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [router, user]);

  return null;
}

