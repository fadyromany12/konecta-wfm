import { query } from "../../db/pool";

export interface ScheduleRow {
  id: string;
  user_id: string;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
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
  shiftStart: string | null;
  shiftEnd: string | null;
  dayType: string;
}): Promise<ScheduleRow> {
  const { rows } = await query<ScheduleRow>(
    `
    INSERT INTO schedules (user_id, date, shift_start, shift_end, day_type, updated_at)
    VALUES ($1, $2, $3, $4, $5, now())
    ON CONFLICT (user_id, date) DO UPDATE SET
      shift_start = EXCLUDED.shift_start,
      shift_end = EXCLUDED.shift_end,
      day_type = EXCLUDED.day_type,
      updated_at = now()
    RETURNING *
    `,
    [params.userId, params.date, params.shiftStart, params.shiftEnd, params.dayType],
  );
  return rows[0];
}
