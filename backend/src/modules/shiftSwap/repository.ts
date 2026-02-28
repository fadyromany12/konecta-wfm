import { query } from "../../db/pool";

export interface ShiftSwapRow {
  id: string;
  requester_id: string;
  target_id: string;
  date: string;
  reason: string | null;
  requester_status: string;
  manager_approval: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function createShiftSwap(
  requesterId: string,
  targetId: string,
  date: string,
  reason: string | null,
): Promise<ShiftSwapRow> {
  const { rows } = await query<ShiftSwapRow>(
    `
    INSERT INTO shift_swaps (requester_id, target_id, date, reason, requester_status, manager_approval, status)
    VALUES ($1, $2, $3, $4, 'pending', 'pending', 'pending')
    RETURNING *
    `,
    [requesterId, targetId, date, reason],
  );
  return rows[0];
}

export async function getShiftSwapsByUser(userId: string): Promise<ShiftSwapRow[]> {
  const { rows } = await query<ShiftSwapRow>(
    `
    SELECT * FROM shift_swaps
    WHERE requester_id = $1 OR target_id = $1
    ORDER BY created_at DESC
    `,
    [userId],
  );
  return rows;
}

export async function getShiftSwapById(id: string): Promise<ShiftSwapRow | null> {
  const { rows } = await query<ShiftSwapRow>(`SELECT * FROM shift_swaps WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function setTargetResponse(
  id: string,
  targetId: string,
  accepted: boolean,
): Promise<boolean> {
  const status = accepted ? "accepted" : "declined";
  const { rowCount } = await query(
    `UPDATE shift_swaps SET requester_status = $2, updated_at = now() WHERE id = $1 AND target_id = $3 AND status = 'pending'`,
    [id, status, targetId],
  );
  return (rowCount ?? 0) > 0;
}

export async function setManagerApproval(
  id: string,
  managerId: string,
  approved: boolean,
): Promise<boolean> {
  const approval = approved ? "approved" : "rejected";
  const newStatus = approved ? "finalized" : "cancelled";
  const { rowCount } = await query(
    `
    UPDATE shift_swaps ss
    SET manager_approval = $2, status = $3, updated_at = now()
    FROM users u
    WHERE ss.id = $1 AND (ss.requester_id = u.id OR ss.target_id = u.id) AND u.manager_id = $4
      AND ss.requester_status = 'accepted' AND ss.manager_approval = 'pending'
    `,
    [id, approval, newStatus, managerId],
  );
  return (rowCount ?? 0) > 0;
}

export async function getPendingShiftSwapsForManager(managerId: string): Promise<ShiftSwapRow[]> {
  const { rows } = await query<ShiftSwapRow>(
    `
    SELECT ss.* FROM shift_swaps ss
    JOIN users u ON (ss.requester_id = u.id OR ss.target_id = u.id)
    WHERE u.manager_id = $1 AND ss.status = 'pending' AND ss.requester_status = 'accepted'
    ORDER BY ss.created_at DESC
    `,
    [managerId],
  );
  return rows;
}
