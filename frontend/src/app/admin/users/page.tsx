"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  manager_id: string | null;
  is_approved: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/");
      return;
    }
    load();
  }, [user, token]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiRequest<UserRow[]>("/admin/users", {}, token);
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          u.first_name.toLowerCase().includes(search.toLowerCase()) ||
          u.last_name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.role.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">All Users</h1>
          <p className="page-subtitle">{users.length} user{users.length !== 1 ? "s" : ""} total</p>
        </div>
        <input
          type="search"
          placeholder="Search by name, email, role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field w-full max-w-xs"
        />
      </div>
      {loading ? (
        <div className="card">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-1/3 rounded bg-slate-700/50" />
            <div className="h-10 rounded bg-slate-700/50" />
            <div className="h-10 rounded bg-slate-700/50" />
            <div className="h-10 rounded bg-slate-700/50" />
          </div>
        </div>
      ) : (
        <div className="card overflow-auto transition-shadow duration-300 hover:shadow-xl">
          <table className="data-table w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Role</th>
                <th className="p-2">Status</th>
                <th className="p-2">Approved</th>
                <th className="p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-800">
                  <td className="p-2 font-medium text-slate-100">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="p-2 text-slate-300">{u.email}</td>
                  <td className="p-2">
                    <span className="capitalize text-slate-300">{u.role}</span>
                  </td>
                  <td className="p-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        u.status === "active"
                          ? "bg-green-900/50 text-green-300"
                          : u.status === "inactive"
                            ? "bg-slate-700 text-slate-400"
                            : "bg-amber-900/50 text-amber-300"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="p-2">{u.is_approved ? "Yes" : "No"}</td>
                  <td className="p-2 text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    {search.trim() ? "No users match your search." : "No users."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
