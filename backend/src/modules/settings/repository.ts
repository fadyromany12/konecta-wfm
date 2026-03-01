import { query } from "../../db/pool";

export async function getSetting(key: string): Promise<string | null> {
  const { rows } = await query<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = $1`,
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const { rows } = await query<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings`,
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
