/**
 * Format total_hours from API (may be string interval, number of seconds, or null).
 * Use everywhere we display attendance total_hours to avoid "replace is not a function".
 */
export function formatTotalHours(value: string | number | null | undefined): string {
  if (value == null) return "-";
  if (typeof value === "number") {
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}:${m.toString().padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return "-";
    // PostgreSQL interval: "08:30:00", "1 day 08:30:00"
    const timePart = s.includes(" ") ? s.split(" ").pop() ?? s : s;
    const [hh, mm] = timePart.split(":");
    const h = hh ? parseInt(hh, 10) : 0;
    const m = mm ? parseInt(mm, 10) : 0;
    if (h === 0 && m === 0) return "0:00";
    return `${h}:${String(m).padStart(2, "0")}`;
  }
  return "-";
}

/** Format time for grid/activity (HH:mm 24h). */
export function formatTimeHHmm(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Format time with seconds for tooltips (HH:mm:ss). */
export function formatTimeHHmmss(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/** Safe label: replace underscores with spaces; handle non-string (API may return number/object). */
export function safeLabel(value: string | number | null | undefined, fallback = "—"): string {
  if (value == null) return fallback;
  if (typeof value !== "string") return String(value);
  return value.replace(/_/g, " ").trim() || fallback;
}

/** Format leave/date-only field (YYYY-MM-DD or ISO string) to local date e.g. "Mar 1, 2026". */
export function formatDateOnly(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return value;
  const d = new Date(s + "T12:00:00");
  return isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
