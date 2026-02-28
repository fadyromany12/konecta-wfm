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
}

export async function getOpenAttendanceForUser(userId: string): Promise<Attendance | null> {
  const { rows } = await query<Attendance>(
    `SELECT * FROM attendance WHERE user_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

export async function createClockIn(userId: string, clockIn: Date, isLate: boolean): Promise<Attendance> {
  const { rows } = await query<Attendance>(
    `
      INSERT INTO attendance (user_id, clock_in, is_late)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [userId, clockIn.toISOString(), isLate],
  );
  return rows[0];
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

