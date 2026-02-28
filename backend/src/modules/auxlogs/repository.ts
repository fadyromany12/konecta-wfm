import { query } from "../../db/pool";

export type AuxType =
  | "break"
  | "lunch"
  | "last_break"
  | "meeting"
  | "coaching"
  | "training"
  | "technical_issue"
  | "floor_support"
  | "available";

export interface AuxLog {
  id: string;
  user_id: string;
  aux_type: AuxType;
  start_time: string;
  end_time: string | null;
  duration: string | null;
  over_limit: boolean;
}

const ONCE_PER_DAY_TYPES: AuxType[] = ["break", "lunch", "last_break"];

export function isOncePerDayType(auxType: AuxType): boolean {
  return ONCE_PER_DAY_TYPES.includes(auxType);
}

/** Count how many times user has used this aux type today (by start_time date). */
export async function countAuxTypeToday(userId: string, auxType: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT count(*) AS count FROM auxlogs WHERE user_id = $1 AND aux_type = $2 AND start_time::date = current_date`,
    [userId, auxType],
  );
  return parseInt(rows[0]?.count ?? "0", 10);
}

export async function getOpenAuxForUser(userId: string): Promise<AuxLog | null> {
  const { rows } = await query<AuxLog>(
    `SELECT * FROM auxlogs WHERE user_id = $1 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

export async function createAux(
  userId: string,
  auxType: AuxType,
  start: Date,
): Promise<AuxLog> {
  const { rows } = await query<AuxLog>(
    `
      INSERT INTO auxlogs (user_id, aux_type, start_time)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [userId, auxType, start.toISOString()],
  );
  return rows[0];
}

export async function closeAux(params: {
  id: string;
  end: Date;
  durationSeconds: number;
  overLimit: boolean;
}): Promise<AuxLog> {
  const { rows } = await query<AuxLog>(
    `
      UPDATE auxlogs
      SET end_time = $2,
          duration = ($3 || ' seconds')::interval,
          over_limit = $4
      WHERE id = $1
      RETURNING *
    `,
    [params.id, params.end.toISOString(), String(params.durationSeconds), params.overLimit],
  );
  return rows[0];
}

export async function getAuxHistoryForUser(
  userId: string,
  from?: string,
  to?: string,
): Promise<AuxLog[]> {
  const conditions = ["user_id = $1"];
  const values: any[] = [userId];

  if (from) {
    conditions.push("start_time >= $2");
    values.push(from);
  }
  if (to) {
    conditions.push("start_time <= $" + (values.length + 1));
    values.push(to);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query<AuxLog>(
    `
      SELECT *
      FROM auxlogs
      ${whereClause}
      ORDER BY start_time DESC
    `,
    values,
  );

  return rows;
}
