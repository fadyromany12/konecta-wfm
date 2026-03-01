import { query } from "../../db/pool";

export interface Attendance {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: string | null;
  is_late: boolean;
  is_early_logout: boolean;
  overtime_duration: string | null;
  timesheet_approved?: boolean;
  shift_date?: string;
}

export async function getOpenAttendanceForUser(userId: string): Promise<Attendance | null> {
  const { rows } = await query<Attendance>(
    `SELECT * FROM attendance WHERE user_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

export async function createClockIn(userId: string, clockIn: Date, isLate: boolean, workLocation?: string): Promise<Attendance> {
  try {
    const { rows } = await query<Attendance>(
      `INSERT INTO attendance (user_id, clock_in, is_late) VALUES ($1, $2, $3) RETURNING *`,
      [userId, clockIn.toISOString(), isLate],
    );
    const row = rows[0];
    if (row && (workLocation === "WFH" || workLocation === "WFO")) {
      try {
        await query(`UPDATE attendance SET work_location = $2 WHERE id = $1`, [row.id, workLocation]);
      } catch {
        // column may not exist yet; run migrations_wfh_wfo.sql
      }
    }
    return row;
  } catch (e: any) {
    if (e?.code === "23505") throw new Error("Already clocked in.");
    throw e;
  }
}

export async function closeAttendanceSession(params: {
  id: string;
  clockOut: Date;
  totalHours: string;
  isEarlyLogout: boolean;
  overtimeDuration: string;
}): Promise<Attendance> {
  const { rows } = await query<Attendance>(
    `
      UPDATE attendance
      SET clock_out = $2,
          total_hours = $3::interval,
          is_early_logout = $4,
          overtime_duration = $5::interval
      WHERE id = $1
      RETURNING *
    `,
    [
      params.id,
      params.clockOut.toISOString(),
      params.totalHours,
      params.isEarlyLogout,
      params.overtimeDuration,
    ],
  );
  return rows[0];
}

export async function getAttendanceHistoryForUser(
  userId: string,
  from?: string,
  to?: string,
): Promise<Attendance[]> {
  const conditions = ["user_id = $1"];
  const values: any[] = [userId];

  if (from) {
    conditions.push("clock_in >= $2");
    values.push(from);
  }
  if (to) {
    conditions.push("clock_in <= $" + (values.length + 1));
    values.push(to);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query<Attendance>(
    `
      SELECT *
      FROM attendance
      ${whereClause}
      ORDER BY clock_in DESC
    `,
    values,
  );

  return rows;
}

/** Lock (approve) attendance records for a user in a date range. Sets timesheet_approved = true. */
export async function lockAttendanceRecords(userId: string, from: string, to: string): Promise<number> {
  const { rowCount } = await query(
    `UPDATE attendance SET timesheet_approved = true WHERE user_id = $1 AND shift_date >= $2 AND shift_date <= $3`,
    [userId, from, to],
  );
  return rowCount ?? 0;
}

/** Returns true if the user has any locked attendance for the given shift_date (prevents clock-in/edit for that date). */
export async function hasLockedAttendanceForUserAndDate(userId: string, dateStr: string): Promise<boolean> {
  const { rows } = await query<{ n: number }>(
    `SELECT 1 AS n FROM attendance WHERE user_id = $1 AND shift_date = $2 AND timesheet_approved = true LIMIT 1`,
    [userId, dateStr],
  );
  return rows.length > 0;
}

/** Get one attendance record by id (for lock check on PATCH). */
export async function getAttendanceById(id: string): Promise<Attendance | null> {
  const { rows } = await query<Attendance>(`SELECT * FROM attendance WHERE id = $1`, [id]);
  return rows[0] || null;
}
