import { query } from "../../db/pool";

export interface LeaveBalance {
  id: string;
  user_id: string;
  year: number;
  leave_type: string;
  balance: string;
  used: string;
  created_at: string;
  updated_at: string;
}

export async function getBalance(userId: string, year: number, leaveType: string): Promise<LeaveBalance | null> {
  const { rows } = await query<LeaveBalance>(
    `SELECT * FROM leave_balances WHERE user_id = $1 AND year = $2 AND leave_type = $3`,
    [userId, year, leaveType],
  );
  return rows[0] || null;
}

/** Available days = balance - used. Returns null if no row (unlimited). */
export async function getAvailableDays(userId: string, year: number, leaveType: string): Promise<number | null> {
  const row = await getBalance(userId, year, leaveType);
  if (!row) return null;
  const balance = parseFloat(row.balance);
  const used = parseFloat(row.used);
  return Math.max(0, balance - used);
}

/** Get all balance rows for a user and year (e.g. annual, sick). */
export async function getBalancesForUser(userId: string, year: number): Promise<LeaveBalance[]> {
  const { rows } = await query<LeaveBalance>(
    `SELECT * FROM leave_balances WHERE user_id = $1 AND year = $2 ORDER BY leave_type`,
    [userId, year],
  );
  return rows;
}

/** Ensure user has at least `days` available. Throws if tracked and insufficient. */
export async function ensureBalance(userId: string, year: number, leaveType: string, days: number): Promise<void> {
  const available = await getAvailableDays(userId, year, leaveType);
  if (available === null) return;
  if (days > available) {
    throw new Error(`Insufficient ${leaveType} leave balance. Available: ${available} days, requested: ${days}.`);
  }
}

/** Add `days` to used. Only updates if a row exists (otherwise balance is unlimited). */
export async function deductBalance(userId: string, year: number, leaveType: string, days: number): Promise<void> {
  await query(
    `UPDATE leave_balances SET used = used + $4, updated_at = now() WHERE user_id = $1 AND year = $2 AND leave_type = $3`,
    [userId, year, leaveType, days],
  );
}

/** Upsert balance (admin sets initial/accrued). */
export async function setBalance(userId: string, year: number, leaveType: string, balance: number, used: number = 0): Promise<void> {
  await query(
    `INSERT INTO leave_balances (user_id, year, leave_type, balance, used, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id, year, leave_type) DO UPDATE SET balance = $4, used = $5, updated_at = now()`,
    [userId, year, leaveType, balance, used],
  );
}
