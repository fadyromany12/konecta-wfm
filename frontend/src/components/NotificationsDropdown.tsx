"use client";

import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "../lib/authStore";
import { apiRequest } from "../lib/api";

interface Notification {
  id: string;
  message: string;
  type: string | null;
  read_status: boolean;
  created_at: string;
}

export default function NotificationsDropdown() {
  const token = useAuthStore((s) => s.token);
  const [list, setList] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !open) return;
    setLoading(true);
    apiRequest<Notification[]>("/notifications", {}, token)
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [token, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  async function markRead(id: string) {
    if (!token) return;
    try {
      await apiRequest(`/notifications/${id}/read`, { method: "PATCH" }, token);
      setList((prev) => prev.map((n) => (n.id === id ? { ...n, read_status: true } : n)));
    } catch {
      // ignore
    }
  }

  const unreadCount = list.filter((n) => !n.read_status).length;

  if (!token) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          <div className="border-b border-slate-700 px-3 py-2 text-sm font-medium text-slate-200">
            Notifications
          </div>
          <div className="max-h-80 overflow-auto">
            {loading ? (
              <p className="p-4 text-center text-sm text-slate-500">Loading…</p>
            ) : list.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-500">No notifications</p>
            ) : (
              list.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markRead(n.id)}
                  className={`w-full border-b border-slate-800 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-800 ${
                    n.read_status ? "text-slate-500" : "text-slate-200"
                  }`}
                >
                  <span className="block">{n.message}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
