import { query } from "../../db/pool";
import type { PoolClient } from "pg";

export type LeaveType = "annual" | "sick" | "casual" | "overtime" | "cancel_day_off";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: string;
  user_id: string;
  type: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  file_url: string | null;
  status: LeaveStatus;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLeaveInput {
  userId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  fileUrl?: string | null;
}

export async function createLeave(input: CreateLeaveInput): Promise<LeaveRequest> {
  const { rows } = await query<LeaveRequest>(
    `
    INSERT INTO leave_requests (user_id, type, start_date, end_date, start_time, end_time, reason, file_url, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    RETURNING *
    `,
    [
      input.userId,
      input.type,
      input.startDate,
      input.endDate,
      input.startTime ?? null,
      input.endTime ?? null,
      input.reason ?? null,
      input.fileUrl ?? null,
    ],
  );
  return rows[0];
}

/** Format date as YYYY-MM-DD without timezone shift (avoid "one day before" for annual leave). */
function toDateOnly(v: string | Date | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") {
    const s = v.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : v;
  }
  const d = v as Date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getLeaveByUser(userId: string): Promise<LeaveRequest[]> {
  const { rows } = await query<LeaveRequest>(
    `SELECT * FROM leave_requests WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({ ...r, start_date: toDateOnly(r.start_date), end_date: toDateOnly(r.end_date) }));
}

export async function getLeaveById(id: string, client?: PoolClient): Promise<LeaveRequest | null> {
  const { rows } = await query<LeaveRequest>(`SELECT * FROM leave_requests WHERE id = $1`, [id], client);
  const r = rows[0];
  if (!r) return null;
  return { ...r, start_date: toDateOnly(r.start_date), end_date: toDateOnly(r.end_date) };
}
