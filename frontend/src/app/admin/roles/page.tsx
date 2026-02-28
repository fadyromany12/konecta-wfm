"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";
import { toast } from "../../../lib/toast";

interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Permission {
  id: string;
  key: string;
  label: string;
  category: string;
}

export default function AdminRolesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPermIds, setNewPermIds] = useState<string[]>([]);

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
  }, [user, token, router]);

  async function load() {
    if (!token) return;
    try {
      const res = await apiRequest<{ roles: Role[]; permissions: Permission[]; rolePermissions: Record<string, string[]> }>("/admin/roles", {}, token);
      setRoles(res.roles);
      setPermissions(res.permissions);
      setRolePermissions(res.rolePermissions || {});
    } catch {
      setRoles([]);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }

  async function createRole() {
    if (!token || !newName.trim()) return;
    try {
      await apiRequest("/admin/roles", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, permissionIds: newPermIds }),
      }, token);
      toast.success("Role created");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      setNewPermIds([]);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    }
  }

  async function updateRole(roleId: string, name: string, description: string | null, permissionIds: string[]) {
    if (!token) return;
    try {
      await apiRequest(`/admin/roles/${roleId}`, {
        method: "PUT",
        body: JSON.stringify({ name, description, permissionIds }),
      }, token);
      toast.success("Role updated");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    }
  }

  const byCategory = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Roles & Permissions</h1>
          <p className="page-subtitle">Create roles and assign app permissions</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary">
          Create role
        </button>
      </div>

      {loading ? (
        <div className="card animate-pulse">Loading…</div>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="p-2">Role</th>
                <th className="p-2">Description</th>
                <th className="p-2">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-slate-800">
                  <td className="p-2 font-medium text-slate-100">{r.name}</td>
                  <td className="p-2 text-slate-400">{r.description || "—"}</td>
                  <td className="p-2 text-slate-300">
                    {(rolePermissions[r.id] || []).length} permission(s)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCreateOpen(false)}>
          <div className="card max-w-lg w-full border-2 border-slate-600 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Create role</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-400">Name</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input-field w-full" placeholder="e.g. Supervisor" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">Description</label>
                <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="input-field w-full" placeholder="Optional" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Permissions</label>
                <div className="max-h-48 overflow-y-auto rounded border border-slate-700 bg-slate-800/50 p-2">
                  {Object.entries(byCategory).map(([cat, perms]) => (
                    <div key={cat} className="mb-2">
                      <p className="text-xs font-medium text-slate-500">{cat}</p>
                      {perms.map((p) => (
                        <label key={p.id} className="mt-1 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newPermIds.includes(p.id)}
                            onChange={(e) => setNewPermIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))}
                          />
                          <span className="text-slate-300">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => createRole()} className="btn-primary" disabled={!newName.trim()}>
                Create
              </button>
              <button type="button" onClick={() => setCreateOpen(false)} className="btn-outline">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
