import { query } from "../../db/pool";
import crypto from "crypto";

export async function createResetToken(userId: string, expiresInHours = 24): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt.toISOString()],
  );
  return token;
}

export async function consumeResetToken(token: string): Promise<string | null> {
  const { rows } = await query<{ user_id: string }>(
    `DELETE FROM password_reset_tokens WHERE token = $1 AND expires_at > now() RETURNING user_id`,
    [token],
  );
  return rows[0]?.user_id ?? null;
}
