"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

interface Announcement {
  id: string;
  title: string;
  body: string;
  visible_from: string;
  visible_to: string | null;
  created_at: string;
}

export default function AnnouncementsWidget() {
  const [list, setList] = useState<Announcement[]>([]);

  useEffect(() => {
    apiRequest<Announcement[]>("/announcements")
      .then(setList)
      .catch(() => setList([]));
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="card space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Announcements</h2>
      <ul className="space-y-3">
        {list.map((a) => (
          <li key={a.id} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
            <p className="font-medium text-slate-200">{a.title}</p>
            <p className="mt-1 text-sm text-slate-400">{a.body}</p>
            <p className="mt-1 text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
