import { query } from "../../db/pool";
import type { PoolClient } from "pg";

export interface LaborRule {
  id: string;
  key: string;
  name: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAll(client?: PoolClient): Promise<LaborRule[]> {
  const { rows } = await query<LaborRule>(
    "SELECT id, key, name, value_num, value_text, unit, created_at, updated_at FROM labor_rules ORDER BY key",
    [],
    client,
  );
  return rows;
}

export async function getByKey(key: string, client?: PoolClient): Promise<LaborRule | null> {
  const { rows } = await query<LaborRule>("SELECT * FROM labor_rules WHERE key = $1", [key], client);
  return rows[0] || null;
}

export async function setRule(key: string, valueNum: number | null, valueText: string | null, client?: PoolClient): Promise<LaborRule> {
  const { rows } = await query<LaborRule>(
    "UPDATE labor_rules SET value_num = $2, value_text = $3, updated_at = now() WHERE key = $1 RETURNING *",
    [key, valueNum, valueText],
    client,
  );
  if (!rows[0]) throw new Error("Rule not found");
  return rows[0];
}

export async function getNumeric(key: string, defaultValue: number, client?: PoolClient): Promise<number> {
  const r = await getByKey(key, client);
  if (r?.value_num != null) return Number(r.value_num);
  return defaultValue;
}
