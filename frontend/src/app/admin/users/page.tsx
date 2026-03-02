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
  role_id: string | null;
  status: string;
  manager_id: string | null;
  is_approved: boolean;
  created_at: string;
}

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
}

interface ManagerOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [updatingManagerId, setUpdatingManagerId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

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
  }, [user, token, page]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [data, rolesRes, managersRes] = await Promise.all([
        apiRequest<{ data?: UserRow[]; total?: number; items?: UserRow[] } | UserRow[]>("/admin/users?page=" + page + "&limit=" + limit, {}, token),
        apiRequest<{ roles: RoleOption[] }>("/admin/roles", {}, token),
        apiRequest<ManagerOption[] | { data?: ManagerOption[] }>("/manager/managers-list", {}, token),
      ]);
      const list = Array.isArray(data) ? data : (data && (data.data ?? data.items ?? []));
      const totalCount = Array.isArray(data) ? data.length : (data && typeof data.total === "number" ? data.total : 0);
      setUsers(Array.isArray(list) ? list : []);
      setTotal(totalCount);
      setRoles((rolesRes as { roles?: RoleOption[] })?.roles || []);
      const mgrList = Array.isArray(managersRes) ? managersRes : (managersRes as { data?: ManagerOption[] })?.data ?? [];
      setManagers(Array.isArray(mgrList) ? mgrList : []);
    } catch {
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(userId: string, roleId: string) {
    if (!token) return;
    setUpdatingRoleId(userId);
    try {
      await apiRequest(`/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ roleId }) }, token);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role_id: roleId, role: roles.find((r) => r.id === roleId)?.name ?? u.role } : u)));
    } catch {
      // keep previous
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function changeManager(userId: string, managerId: string | null) {
    if (!token) return;
    setUpdatingManagerId(userId);
    try {
      await apiRequest(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify({ manager_id: managerId || null }) }, token);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, manager_id: managerId || null } : u)));
    } catch {
      // keep previous
    } finally {
      setUpdatingManagerId(null);
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
          <p className="page-subtitle">{search.trim() ? filtered.length + " of " + total : total} user{total !== 1 ? "s" : ""} total. Change direct report below; role changes apply after the user logs out and back in.</p>
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
                <th className="p-2">Direct report</th>
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
                    <select
                      value={u.role_id || ""}
                      onChange={(e) => { const v = e.target.value; if (v) changeRole(u.id, v); }}
                      disabled={!!updatingRoleId}
                      className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      value={u.manager_id || ""}
                      onChange={(e) => changeManager(u.id, e.target.value || null)}
                      disabled={!!updatingManagerId}
                      className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 min-w-[140px]"
                    >
                      <option value="">— None —</option>
                      {managers.filter((m) => m.id !== u.id).map((m) => (
                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                      ))}
                    </select>
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
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    {search.trim() ? "No users match your search." : "No users."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!search.trim() && total > limit && (
            <div className="flex items-center justify-between border-t border-slate-700 px-3 py-2">
              <span className="text-sm text-slate-400">
                Page {page} of {Math.ceil(total / limit)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= total}
                  className="btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
