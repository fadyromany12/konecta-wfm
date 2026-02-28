import { query } from "../../db/pool";
import crypto from "crypto";

const EXPIRY_HOURS = 24;

export async function createVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);
  await query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt.toISOString()],
  );
  return token;
}

export async function consumeVerificationToken(token: string): Promise<string | null> {
  const { rows } = await query<{ user_id: string }>(
    `DELETE FROM email_verification_tokens WHERE token = $1 AND expires_at > now() RETURNING user_id`,
    [token],
  );
  return rows[0]?.user_id ?? null;
}
