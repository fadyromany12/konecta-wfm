"use client";

import { useEffect } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onCancel]);

  if (!open) return null;

  const Icon = variant === "danger" ? Trash2 : AlertTriangle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl animate-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              variant === "danger" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
            }`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 id="confirm-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p className="mt-2 text-sm text-slate-400">{message}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="btn-outline flex-1"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={
                  variant === "danger"
                    ? "flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500"
                    : "btn-primary flex-1"
                }
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
