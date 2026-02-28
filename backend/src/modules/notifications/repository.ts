import { query } from "../../db/pool";

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  type: string | null;
  read_status: boolean;
  created_at: string;
}

export async function createNotification(
  userId: string,
  message: string,
  type?: string,
): Promise<Notification> {
  const { rows } = await query<Notification>(
    `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3) RETURNING *`,
    [userId, message, type ?? null],
  );
  return rows[0];
}

export async function getByUser(userId: string, unreadOnly = false): Promise<Notification[]> {
  const sql = unreadOnly
    ? `SELECT * FROM notifications WHERE user_id = $1 AND read_status = false ORDER BY created_at DESC`
    : `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`;
  const { rows } = await query<Notification>(sql, [userId]);
  return rows;
}

export async function markRead(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE notifications SET read_status = true WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (rowCount ?? 0) > 0;
}

export async function markAllRead(userId: string): Promise<void> {
  await query(`UPDATE notifications SET read_status = true WHERE user_id = $1`, [userId]);
}
