import { query } from "../../db/pool";
import type { PoolClient } from "pg";

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
  version: number;
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

export async function getScheduleByUserAndDate(
  userId: string,
  date: string,
  client?: PoolClient,
): Promise<ScheduleRow | null> {
  const { rows } = await query<ScheduleRow>(
    `SELECT * FROM schedules WHERE user_id = $1 AND date = $2 ORDER BY id LIMIT 1`,
    [userId, date],
    client,
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

/** Admin: list schedules in date range, optional filter by user_id. */
export async function getSchedulesForAdmin(
  from: string,
  to: string,
  userId?: string,
  client?: PoolClient,
): Promise<(ScheduleRow & { first_name?: string; last_name?: string; email?: string })[]> {
  let sql = `SELECT s.*, u.first_name, u.last_name, u.email FROM schedules s JOIN users u ON s.user_id = u.id WHERE s.date >= $1 AND s.date <= $2`;
  const params: (string | number)[] = [from, to];
  if (userId) {
    params.push(userId);
    sql += ` AND s.user_id = $3`;
  }
  sql += ` ORDER BY s.date, u.first_name`;
  const { rows } = await query(sql, params, client);
  return rows;
}

export type ScheduleUpsertParams = {
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
};

/** Insert a new schedule row. Overlap is enforced by DB exclusion constraint. */
export async function insertSchedule(params: ScheduleUpsertParams, client?: PoolClient): Promise<ScheduleRow> {
  const { rows } = await query<ScheduleRow>(
    `INSERT INTO schedules (user_id, date, project_id, shift_start, shift_end, break_1_start, break_1_end, break_2_start, break_2_end, break_3_start, break_3_end, day_type, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
     RETURNING *`,
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
    client,
  );
  return rows[0];
}

/** Update by id with OCC. Throws if version mismatch (caller should return 409). */
export async function updateSchedule(
  id: string,
  version: number,
  params: ScheduleUpsertParams,
  client?: PoolClient,
): Promise<ScheduleRow> {
  const { rows } = await query<ScheduleRow>(
    `UPDATE schedules SET
       project_id = COALESCE($3, project_id),
       shift_start = $4,
       shift_end = $5,
       break_1_start = $6,
       break_1_end = $7,
       break_2_start = $8,
       break_2_end = $9,
       break_3_start = $10,
       break_3_end = $11,
       day_type = $12,
       version = version + 1,
       updated_at = now()
     WHERE id = $1 AND version = $2
     RETURNING *`,
    [
      id,
      version,
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
    client,
  );
  if (!rows[0]) throw new Error("CONFLICT");
  return rows[0];
}

/** Get by id (for OCC check). */
export async function getScheduleById(id: string, client?: PoolClient): Promise<ScheduleRow | null> {
  const { rows } = await query<ScheduleRow>(`SELECT * FROM schedules WHERE id = $1`, [id], client);
  return rows[0] || null;
}

/** Upsert: if row exists for (user_id, date) then update with OCC; else insert. For single-row use. */
export async function upsertSchedule(params: ScheduleUpsertParams, client?: PoolClient): Promise<ScheduleRow> {
  const existing = await getScheduleByUserAndDate(params.userId, params.date, client);
  if (existing) {
    return updateSchedule(existing.id, existing.version, params, client);
  }
  return insertSchedule(params, client);
}

/** Bulk upsert in one transaction. Each item is (user_id, date, ...). Uses select-then-update-or-insert per row. */
export async function batchUpsertSchedules(
  items: ScheduleUpsertParams[],
  client: PoolClient,
): Promise<{ updated: number; inserted: number }> {
  let updated = 0;
  let inserted = 0;
  for (const params of items) {
    const existing = await getScheduleByUserAndDate(params.userId, params.date, client);
    if (existing) {
      await updateSchedule(existing.id, existing.version, params, client);
      updated++;
    } else {
      await insertSchedule(params, client);
      inserted++;
    }
  }
  return { updated, inserted };
}
