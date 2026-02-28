import { query } from "../db/pool";

export async function logAudit(action: string, userId: string | null, metadata?: Record<string, unknown>, ip?: string): Promise<void> {
  await query(
    `INSERT INTO audit_logs (action, user_id, metadata, ip) VALUES ($1, $2, $3, $4)`,
    [action, userId, metadata ? JSON.stringify(metadata) : null, ip ?? null],
  );
}
