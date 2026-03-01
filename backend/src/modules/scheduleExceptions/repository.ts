import { query } from "../../db/pool";
import type { PoolClient } from "pg";

/** Insert a schedule exception (leave or swap). Use ON CONFLICT to replace for same (user_id, date). */
export async function insertException(
  params: {
    userId: string;
    date: string;
    exceptionType: "leave" | "swap";
    refId: string;
    shiftStart?: string | null;
    shiftEnd?: string | null;
  },
  client?: PoolClient,
): Promise<void> {
  await query(
    `INSERT INTO schedule_exceptions (user_id, date, exception_type, ref_id, shift_start, shift_end)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, date) DO UPDATE SET
       exception_type = EXCLUDED.exception_type,
       ref_id = EXCLUDED.ref_id,
       shift_start = EXCLUDED.shift_start,
       shift_end = EXCLUDED.shift_end`,
    [
      params.userId,
      params.date,
      params.exceptionType,
      params.refId,
      params.shiftStart ?? null,
      params.shiftEnd ?? null,
    ],
    client,
  );
}
