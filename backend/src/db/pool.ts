import { Pool } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number }> {
  return pool.query<T>(text, params);
}

