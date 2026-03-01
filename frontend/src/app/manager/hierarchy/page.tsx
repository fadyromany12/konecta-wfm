"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../lib/authStore";
import { apiRequest } from "../../../lib/api";

interface TreeNode {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  manager_id: string | null;
  children: TreeNode[];
}

function TreeLevel({ nodes, level = 0 }: { nodes: TreeNode[]; level?: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!nodes.length) return null;
  return (
    <ul className={level > 0 ? "ml-6 border-l border-slate-700 pl-4" : ""}>
      {nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExp = expanded[node.id] !== false;
        return (
          <li key={node.id} className="py-1.5">
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [node.id]: !s[node.id] }))}
                  className="text-slate-400 hover:text-slate-200"
                >
                  {isExp ? "v" : ">"}
                </button>
              ) : (
                <span className="w-4" />
              )}
              <span className="font-medium text-slate-50">{node.first_name} {node.last_name}</span>
              <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">{node.role}</span>
              <span className="text-sm text-slate-500">{node.email}</span>
            </div>
            {hasChildren && isExp && <TreeLevel nodes={node.children} level={level + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

export default function ManagerHierarchyPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (user.role !== "manager" && user.role !== "admin") {
      router.replace("/");
      return;
    }
    load();
  }, [user, token, router]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<TreeNode[]>("/manager/org-tree", {}, token);
      setTree(Array.isArray(res) ? res : []);
    } catch {
      setTree([]);
      setError("Failed to load hierarchy");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-50">Hierarchy</h1>
      <p className="text-slate-400">
        {user.role === "admin" ? "Full organization tree." : "Your team and reports."}
      </p>
      {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="card overflow-auto">
          <TreeLevel nodes={tree} />
          {tree.length === 0 && <p className="text-slate-500">No hierarchy data.</p>}
        </div>
      )}
    </div>
  );
}
