import { query } from "../../db/pool";

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

export async function getLeaveByUser(userId: string): Promise<LeaveRequest[]> {
  const { rows } = await query<LeaveRequest>(
    `SELECT * FROM leave_requests WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function getLeaveById(id: string): Promise<LeaveRequest | null> {
  const { rows } = await query<LeaveRequest>(`SELECT * FROM leave_requests WHERE id = $1`, [id]);
  return rows[0] || null;
}
