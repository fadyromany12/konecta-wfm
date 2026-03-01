/**
 * Date helpers that avoid DST bugs: use calendar-day arithmetic (setDate) instead of fixed millisecond deltas.
 */

/** Add n calendar days (handles DST). */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Return YYYY-MM-DD for today minus n days. */
export function daysAgo(n: number): string {
  return toDateOnly(addDays(new Date(), -n));
}

export function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Return YYYY-MM-DD for "today" in the given IANA timezone (e.g. 'UTC', 'Africa/Cairo'). */
export function getTodayInTimezone(timezone: string): string {
  return formatDateInTimezone(new Date(), timezone);
}

/** Format a date as YYYY-MM-DD in the given IANA timezone. */
export function formatDateInTimezone(d: Date | string, timezone: string): string {
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    return (typeof d === "string" ? d : (d as Date).toISOString()).slice(0, 10);
  }
}

/** Return a Date representing "now" interpreted in the given timezone (for comparison with shift times). */
export function nowInTimezone(timezone: string): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: timezone });
  return new Date(str);
}

/** Iterate calendar days from fromStr (YYYY-MM-DD) through toStr inclusive. */
export function* iterateDateRange(fromStr: string, toStr: string): Generator<string> {
  let d = new Date(fromStr + "T12:00:00Z");
  const end = new Date(toStr + "T12:00:00Z");
  while (d <= end) {
    yield toDateOnly(d);
    d = addDays(d, 1);
  }
}

export function dateRangeArray(fromStr: string, toStr: string): string[] {
  return Array.from(iterateDateRange(fromStr, toStr));
}
