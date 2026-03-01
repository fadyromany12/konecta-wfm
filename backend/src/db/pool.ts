import { Pool, PoolClient } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

/** Execute a query. Pass client when inside runInTransaction to use the same connection. */
export async function query<T = any>(
  text: string,
  params?: any[],
  client?: PoolClient,
): Promise<{ rows: T[]; rowCount?: number }> {
  const runner = client ?? pool;
  return runner.query<T>(text, params);
}

/** Run multiple queries in a single transaction. Rolls back on throw. */
export async function runInTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

