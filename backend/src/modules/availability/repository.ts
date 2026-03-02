import { query } from "../../db/pool";
import type { PoolClient } from "pg";

export interface AvailabilityWindow {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface ShiftPreference {
  id: string;
  user_id: string;
  key: string;
  value: string | null;
  created_at: string;
}

export async function getWindowsByUser(userId: string, client?: PoolClient): Promise<AvailabilityWindow[]> {
  const { rows } = await query<AvailabilityWindow>(
    "SELECT id, user_id, day_of_week, start_time::text, end_time::text, created_at FROM availability_windows WHERE user_id = $1 ORDER BY day_of_week, start_time",
    [userId],
    client,
  );
  return rows;
}

export async function getPreferencesByUser(userId: string, client?: PoolClient): Promise<ShiftPreference[]> {
  const { rows } = await query<ShiftPreference>(
    "SELECT id, user_id, key, value, created_at FROM shift_preferences WHERE user_id = $1 ORDER BY key",
    [userId],
    client,
  );
  return rows;
}

export async function setWindows(
  userId: string,
  windows: { day_of_week: number; start_time: string; end_time: string }[],
  client?: PoolClient,
): Promise<AvailabilityWindow[]> {
  await query("DELETE FROM availability_windows WHERE user_id = $1", [userId], client);
  const out: AvailabilityWindow[] = [];
  for (const w of windows) {
    const { rows } = await query<AvailabilityWindow>(
      "INSERT INTO availability_windows (user_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3::time, $4::time) RETURNING id, user_id, day_of_week, start_time::text, end_time::text, created_at",
      [userId, w.day_of_week, w.start_time, w.end_time],
      client,
    );
    if (rows[0]) out.push(rows[0]);
  }
  return out;
}

export async function setPreferences(
  userId: string,
  prefs: { key: string; value: string | null }[],
  client?: PoolClient,
): Promise<ShiftPreference[]> {
  const out: ShiftPreference[] = [];
  for (const p of prefs) {
    const { rows } = await query<ShiftPreference>(
      "INSERT INTO shift_preferences (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value RETURNING id, user_id, key, value, created_at",
      [userId, p.key, p.value],
      client,
    );
    if (rows[0]) out.push(rows[0]);
  }
  return out;
}
