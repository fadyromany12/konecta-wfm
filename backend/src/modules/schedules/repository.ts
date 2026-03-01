import { query } from "../../db/pool";

export interface ScheduleRow {
  id: string;
  user_id: string;
  date: string;
  project_id: string | null;
  shift_start: string | null;
  shift_end: string | null;
  break_1_start: string | null;
  break_1_end: string | null;
  break_2_start: string | null;
  break_2_end: string | null;
  break_3_start: string | null;
  break_3_end: string | null;
  day_type: string;
  is_overtime_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export async function getScheduleByUser(
  userId: string,
  from: string,
  to: string,
): Promise<ScheduleRow[]> {
  const { rows } = await query<ScheduleRow>(
    `SELECT * FROM schedules WHERE user_id = $1 AND date >= $2 AND date <= $3 ORDER BY date`,
    [userId, from, to],
  );
  return rows;
}

export async function getScheduleByUserAndDate(userId: string, date: string): Promise<ScheduleRow | null> {
  const { rows } = await query<ScheduleRow>(
    `SELECT * FROM schedules WHERE user_id = $1 AND date = $2`,
    [userId, date],
  );
  return rows[0] || null;
}

export async function getTeamSchedulesByManager(
  managerId: string,
  from: string,
  to: string,
): Promise<ScheduleRow[]> {
  const { rows } = await query<ScheduleRow>(
    `
    SELECT s.* FROM schedules s
    JOIN users u ON s.user_id = u.id
    WHERE u.manager_id = $1 AND s.date >= $2 AND s.date <= $3
    ORDER BY s.date, u.first_name
    `,
    [managerId, from, to],
  );
  return rows;
}

export async function upsertSchedule(params: {
  userId: string;
  date: string;
  projectId?: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  break1Start?: string | null;
  break1End?: string | null;
  break2Start?: string | null;
  break2End?: string | null;
  break3Start?: string | null;
  break3End?: string | null;
  dayType: string;
}): Promise<ScheduleRow> {
  const { rows } = await query<ScheduleRow>(
    `
    INSERT INTO schedules (user_id, date, project_id, shift_start, shift_end, break_1_start, break_1_end, break_2_start, break_2_end, break_3_start, break_3_end, day_type, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
    ON CONFLICT (user_id, date) DO UPDATE SET
      project_id = COALESCE(EXCLUDED.project_id, schedules.project_id),
      shift_start = EXCLUDED.shift_start,
      shift_end = EXCLUDED.shift_end,
      break_1_start = EXCLUDED.break_1_start,
      break_1_end = EXCLUDED.break_1_end,
      break_2_start = EXCLUDED.break_2_start,
      break_2_end = EXCLUDED.break_2_end,
      break_3_start = EXCLUDED.break_3_start,
      break_3_end = EXCLUDED.break_3_end,
      day_type = EXCLUDED.day_type,
      updated_at = now()
    RETURNING *
    `,
    [
      params.userId,
      params.date,
      params.projectId ?? null,
      params.shiftStart,
      params.shiftEnd,
      params.break1Start ?? null,
      params.break1End ?? null,
      params.break2Start ?? null,
      params.break2End ?? null,
      params.break3Start ?? null,
      params.break3End ?? null,
      params.dayType,
    ],
  );
  return rows[0];
}
