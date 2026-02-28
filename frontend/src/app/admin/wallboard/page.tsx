"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";

export default function AdminWallboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role === "admin" || user.role === "manager") router.replace("/manager/wallboard");
    else router.replace("/");
  }, [user, router]);

  return null;
}
