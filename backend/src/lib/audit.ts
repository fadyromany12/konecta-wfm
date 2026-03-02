import { query } from "../db/pool";
import type { PoolClient } from "pg";

/** Log an audit event. user_id = actor who performed the action; target/details go in metadata. */
export async function logAudit(
  action: string,
  actorUserId: string | null,
  metadata?: Record<string, unknown>,
  ip?: string,
  client?: PoolClient,
): Promise<void> {
  await query(
    `INSERT INTO audit_logs (action, user_id, metadata, ip) VALUES ($1, $2, $3, $4)`,
    [action, actorUserId, metadata ? JSON.stringify(metadata) : null, ip ?? null],
    client,
  );
}
