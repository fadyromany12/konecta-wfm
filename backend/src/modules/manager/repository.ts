import { query } from "../../db/pool";
import type { PoolClient } from "pg";

export async function getTransferRequestsMine(requestedBy: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT r.*, a.first_name AS agent_first_name, a.last_name AS agent_last_name,
     fm.first_name AS from_manager_first_name, fm.last_name AS from_manager_last_name,
     tm.first_name AS to_manager_first_name, tm.last_name AS to_manager_last_name
     FROM reporting_line_change_requests r
     JOIN users a ON a.id = r.agent_id
     JOIN users fm ON fm.id = r.from_manager_id
     JOIN users tm ON tm.id = r.to_manager_id
     WHERE r.requested_by = $1 ORDER BY r.created_at DESC`,
    [requestedBy],
    client,
  );
  return rows;
}

const TRANSFER_BASE_SQL = `SELECT r.*, a.first_name AS agent_first_name, a.last_name AS agent_last_name,
  fm.first_name AS from_manager_first_name, fm.last_name AS from_manager_last_name,
  tm.first_name AS to_manager_first_name, tm.last_name AS to_manager_last_name
  FROM reporting_line_change_requests r
  JOIN users a ON a.id = r.agent_id
  JOIN users fm ON fm.id = r.from_manager_id
  JOIN users tm ON tm.id = r.to_manager_id`;

export async function getTransferRequestsAll(client?: PoolClient) {
  const { rows } = await query(`${TRANSFER_BASE_SQL} ORDER BY r.created_at DESC`, [], client);
  return rows;
}

export async function getTransferRequestsByFromManager(managerId: string, client?: PoolClient) {
  const { rows } = await query(
    `${TRANSFER_BASE_SQL} WHERE fm.manager_id = $1 ORDER BY r.created_at DESC`,
    [managerId],
    client,
  );
  return rows;
}

export async function getTransferRequestsPending(client?: PoolClient) {
  const { rows } = await query(
    `${TRANSFER_BASE_SQL} WHERE r.status = 'pending' ORDER BY r.created_at DESC`,
    [],
    client,
  );
  return rows;
}

export async function getTransferRequestsPendingByManager(managerId: string, client?: PoolClient) {
  const { rows } = await query(
    `${TRANSFER_BASE_SQL} WHERE r.status = 'pending' AND fm.manager_id = $1 ORDER BY r.created_at DESC`,
    [managerId],
    client,
  );
  return rows;
}

export async function getTransferRequestById(id: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT r.agent_id, r.from_manager_id, r.to_manager_id FROM reporting_line_change_requests r
     JOIN users fm ON fm.id = r.from_manager_id
     WHERE r.id = $1 AND r.status = 'pending'`,
    [id],
    client,
  );
  return rows[0];
}

export async function getManagerIdByUserId(userId: string, client?: PoolClient) {
  const { rows } = await query("SELECT manager_id FROM users WHERE id = $1", [userId], client);
  return rows[0]?.manager_id;
}

export async function updateUserManagerId(agentId: string, toManagerId: string, client?: PoolClient) {
  await query("UPDATE users SET manager_id = $2 WHERE id = $1", [agentId, toManagerId], client);
}

export async function approveTransferRequest(id: string, approverId: string, client?: PoolClient) {
  await query(
    "UPDATE reporting_line_change_requests SET status = 'approved', approved_by = $2, updated_at = now() WHERE id = $1",
    [id, approverId],
    client,
  );
}

export async function rejectTransferRequest(id: string, approverId: string, client?: PoolClient) {
  await query(
    "UPDATE reporting_line_change_requests SET status = 'rejected', approved_by = $2, updated_at = now() WHERE id = $1",
    [id, approverId],
    client,
  );
}

export async function getTransferRequestFromManager(id: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT r.from_manager_id FROM reporting_line_change_requests r JOIN users fm ON fm.id = r.from_manager_id WHERE r.id = $1 AND r.status = 'pending'`,
    [id],
    client,
  );
  return rows[0];
}

export async function getTeamWithManager(managerId: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.manager_id, m.first_name AS manager_first_name, m.last_name AS manager_last_name
     FROM users u LEFT JOIN users m ON m.id = u.manager_id WHERE u.manager_id = $1 ORDER BY u.first_name, u.last_name`,
    [managerId],
    client,
  );
  return rows;
}

export async function getTeamWithManagerAll(client?: PoolClient) {
  const { rows } = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.manager_id, m.first_name AS manager_first_name, m.last_name AS manager_last_name
     FROM users u LEFT JOIN users m ON m.id = u.manager_id ORDER BY u.first_name, u.last_name`,
    [],
    client,
  );
  return rows;
}

export async function getUsersForOrgTree(client?: PoolClient) {
  const { rows } = await query(
    `SELECT id, first_name, last_name, email, role, manager_id FROM users WHERE status = 'active' ORDER BY first_name, last_name`,
    [],
    client,
  );
  return rows;
}

export async function getPendingApprovals(managerId: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT id, first_name, last_name, email, created_at FROM users WHERE manager_id = $1 AND is_approved = false AND role = 'agent' ORDER BY created_at DESC`,
    [managerId],
    client,
  );
  return rows;
}

export async function getUserForApprove(userId: string, managerId: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT id FROM users WHERE id = $1 AND manager_id = $2 AND is_approved = false`,
    [userId, managerId],
    client,
  );
  return rows[0];
}

export async function getUserName(userId: string, client?: PoolClient) {
  const { rows } = await query(`SELECT first_name, last_name FROM users WHERE id = $1`, [userId], client);
  return rows[0];
}

export async function getPasswordResetRequests(managerId: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT prr.id, prr.user_id, prr.requested_at, u.first_name, u.last_name, u.email
     FROM password_reset_requests prr
     JOIN users u ON u.id = prr.user_id
     WHERE u.manager_id = $1 AND prr.handled_at IS NULL ORDER BY prr.requested_at DESC`,
    [managerId],
    client,
  );
  return rows;
}

export async function getUserByManager(userId: string, managerId: string, client?: PoolClient) {
  const { rows } = await query(`SELECT id FROM users WHERE id = $1 AND manager_id = $2`, [userId, managerId], client);
  return rows[0];
}

export async function getManagersList(excludeUserId: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT id, first_name, last_name, email, role FROM users WHERE role IN ('manager', 'admin') AND status = 'active' AND id != $1 ORDER BY role, first_name, last_name`,
    [excludeUserId],
    client,
  );
  return rows;
}

export async function getAgentByManager(agentId: string, fromManagerId: string, client?: PoolClient) {
  const { rows } = await query("SELECT id FROM users WHERE id = $1 AND manager_id = $2", [agentId, fromManagerId], client);
  return rows[0];
}

export async function getManagerOrAdmin(userId: string, client?: PoolClient) {
  const { rows } = await query("SELECT id FROM users WHERE id = $1 AND role IN ('manager','admin')", [userId], client);
  return rows[0];
}

export async function createTransferRequest(agentId: string, fromManagerId: string, toManagerId: string, client?: PoolClient) {
  const { rows } = await query(
    `INSERT INTO reporting_line_change_requests (agent_id, from_manager_id, to_manager_id, requested_by) VALUES ($1, $2, $3, $4) RETURNING *`,
    [agentId, fromManagerId, toManagerId, fromManagerId],
    client,
  );
  return rows[0];
}

export async function getTeamSummaryAux(managerId: string, from: string, to: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT al.aux_type, COUNT(*) AS cnt FROM auxlogs al
     JOIN users u ON u.id = al.user_id
     WHERE u.manager_id = $1 AND al.start_time::date >= $2 AND al.start_time::date <= $3
     GROUP BY al.aux_type`,
    [managerId, from, to],
    client,
  );
  return rows;
}

export async function getTeamSummaryLeave(managerId: string, from: string, to: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT lr.type, COUNT(*) AS cnt FROM leave_requests lr
     JOIN users u ON u.id = lr.user_id
     WHERE u.manager_id = $1 AND lr.status = 'approved' AND lr.start_date <= $3 AND lr.end_date >= $2
     GROUP BY lr.type`,
    [managerId, from, to],
    client,
  );
  return rows;
}

export async function getTeamAuxToday(managerId: string, today: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT u.id AS user_id, u.first_name, u.last_name, al.aux_type, al.start_time
     FROM auxlogs al
     JOIN users u ON u.id = al.user_id
     WHERE u.manager_id = $1 AND al.start_time::date = $2 AND al.end_time IS NULL
     ORDER BY al.start_time`,
    [managerId, today],
    client,
  );
  return rows;
}

export async function getTeamPaginated(managerId: string, limit: number, offset: number, client?: PoolClient) {
  const { rows } = await query(
    `SELECT id, first_name, last_name, email, role, status, created_at
     FROM users WHERE manager_id = $1 ORDER BY first_name, last_name LIMIT $2 OFFSET $3`,
    [managerId, limit, offset],
    client,
  );
  return rows;
}

export async function getTeamCount(managerId: string, client?: PoolClient) {
  const { rows } = await query<{ count: string }>(`SELECT count(*) AS count FROM users WHERE manager_id = $1`, [managerId], client);
  return parseInt(rows[0]?.count ?? "0", 10);
}

export async function getTeamAttendance(managerId: string, targetDate: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT u.id AS user_id, u.first_name, u.last_name, a.clock_in, a.clock_out, a.total_hours, a.is_late, a.is_early_logout, a.overtime_duration, a.work_location
     FROM users u
     LEFT JOIN attendance a ON a.user_id = u.id AND a.shift_date = $2
     WHERE u.manager_id = $1 ORDER BY u.first_name, u.last_name`,
    [managerId, targetDate],
    client,
  );
  return rows;
}

export async function getLeavePending(managerId: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT lr.*, u.first_name, u.last_name
     FROM leave_requests lr JOIN users u ON lr.user_id = u.id
     WHERE u.manager_id = $1 AND lr.status = 'pending' ORDER BY lr.created_at DESC`,
    [managerId],
    client,
  );
  return rows;
}

export async function getLeaveTeam(managerId: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT lr.*, u.first_name, u.last_name
     FROM leave_requests lr JOIN users u ON lr.user_id = u.id
     WHERE u.manager_id = $1 ORDER BY lr.created_at DESC`,
    [managerId],
    client,
  );
  return rows;
}

export async function getLeaveRequestForReject(leaveId: string, managerId: string, client?: PoolClient) {
  const { rows } = await query<{ user_id: string }>(
    `SELECT lr.user_id FROM leave_requests lr JOIN users u ON lr.user_id = u.id WHERE lr.id = $1 AND u.manager_id = $2 AND lr.status = 'pending'`,
    [leaveId, managerId],
    client,
  );
  return rows[0];
}

export async function rejectLeaveRequest(leaveId: string, managerId: string, client?: PoolClient) {
  await query(
    `UPDATE leave_requests SET status = 'rejected', approved_by = $2 WHERE id = $1`,
    [leaveId, managerId],
    client,
  );
}

export async function createScheduleActivity(
  user_id: string,
  activity_date: string,
  type: string,
  start_at: string,
  end_at: string,
  title: string | null,
  notes: string | null,
  created_by: string,
  client?: PoolClient,
) {
  const { rows } = await query(
    `INSERT INTO schedule_activities (user_id, activity_date, type, start_at, end_at, title, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [user_id, activity_date, type, start_at, end_at, title, notes, created_by],
    client,
  );
  return rows[0];
}

export async function getAttendanceByIdAndManager(attendanceId: string, managerId: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT a.user_id, a.clock_in, a.clock_out, a.timesheet_approved FROM attendance a JOIN users u ON u.id = a.user_id WHERE a.id = $1 AND u.manager_id = $2`,
    [attendanceId, managerId],
    client,
  );
  return rows[0];
}

export async function updateAttendancePunch(
  id: string,
  clock_in: string,
  clock_out: string | null,
  total_hours: string,
  client?: PoolClient,
) {
  const { rows } = await query(
    `UPDATE attendance SET clock_in = $2, clock_out = $3, total_hours = $4::interval WHERE id = $1 RETURNING *`,
    [id, clock_in, clock_out, total_hours],
    client,
  );
  return rows[0];
}

export async function insertAttendanceManual(
  user_id: string,
  clock_in: string,
  clock_out: string | null,
  total_hours: string,
  client?: PoolClient,
) {
  const { rows } = await query(
    `INSERT INTO attendance (user_id, clock_in, clock_out, total_hours, is_late, is_early_logout, overtime_duration)
     VALUES ($1, $2, $3, $4::interval, false, false, '0 seconds'::interval) RETURNING *`,
    [user_id, clock_in, clock_out, total_hours],
    client,
  );
  return rows[0];
}

export async function getExportAttendance(managerId: string, from: string, to: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT a.id, u.first_name, u.last_name, u.email, a.clock_in, a.clock_out, a.total_hours, a.is_late, a.is_early_logout, a.overtime_duration, a.shift_date
     FROM attendance a JOIN users u ON u.id = a.user_id
     WHERE u.manager_id = $1 AND a.clock_in::date >= $2 AND a.clock_in::date <= $3 ORDER BY a.clock_in`,
    [managerId, from, to],
    client,
  );
  return rows;
}

export async function getExportLeave(managerId: string, from: string, to: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT lr.id, u.first_name, u.last_name, u.email, lr.type, lr.start_date, lr.end_date, lr.reason, lr.status, lr.created_at
     FROM leave_requests lr JOIN users u ON u.id = lr.user_id
     WHERE u.manager_id = $1 AND lr.start_date <= $3 AND lr.end_date >= $2 ORDER BY lr.created_at`,
    [managerId, from, to],
    client,
  );
  return rows;
}

export async function getExportAux(managerId: string, from: string, to: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT al.id, u.first_name, u.last_name, u.email, al.aux_type, al.start_time, al.end_time, al.duration, al.over_limit
     FROM auxlogs al JOIN users u ON u.id = al.user_id
     WHERE u.manager_id = $1 AND al.start_time::date >= $2 AND al.start_time::date <= $3 ORDER BY al.start_time`,
    [managerId, from, to],
    client,
  );
  return rows;
}

export async function getManagerNotes(managerId: string, userId?: string, client?: PoolClient) {
  let sql = `SELECT mn.*, u.first_name, u.last_name FROM manager_notes mn JOIN users u ON mn.user_id = u.id WHERE mn.manager_id = $1`;
  const params: string[] = [managerId];
  if (userId) {
    params.push(userId);
    sql += ` AND mn.user_id = $2`;
  }
  sql += ` ORDER BY mn.created_at DESC`;
  const { rows } = await query(sql, params, client);
  return rows;
}

export async function createManagerNote(user_id: string, manager_id: string, note_type: string, content: string, client?: PoolClient) {
  const { rows } = await query(
    `INSERT INTO manager_notes (user_id, manager_id, note_type, content) VALUES ($1, $2, $3, $4) RETURNING *`,
    [user_id, manager_id, note_type, content],
    client,
  );
  return rows[0];
}

export async function getDisciplinary(managerId: string, userId?: string, client?: PoolClient) {
  let sql = `SELECT d.*, u.first_name, u.last_name FROM disciplinary_actions d JOIN users u ON d.user_id = u.id WHERE d.manager_id = $1`;
  const params: string[] = [managerId];
  if (userId) {
    params.push(userId);
    sql += ` AND d.user_id = $2`;
  }
  sql += ` ORDER BY d.created_at DESC`;
  const { rows } = await query(sql, params, client);
  return rows;
}

export async function createDisciplinary(
  user_id: string,
  manager_id: string,
  action_type: string,
  description: string | null,
  severity: string,
  client?: PoolClient,
) {
  const { rows } = await query(
    `INSERT INTO disciplinary_actions (user_id, manager_id, action_type, description, severity) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [user_id, manager_id, action_type, description, severity],
    client,
  );
  return rows[0];
}

export async function getAttendanceScores(managerId: string, periodStart: string, periodEnd: string, client?: PoolClient) {
  const { rows } = await query(
    `SELECT user_id, period_start, period_end, punctuality_score, break_compliance, overtime_score, absence_ratio, overall_score
     FROM attendance_scores
     WHERE user_id IN (SELECT id FROM users WHERE manager_id = $1) AND period_start = $2 AND period_end = $3
     ORDER BY overall_score DESC NULLS LAST`,
    [managerId, periodStart, periodEnd],
    client,
  );
  return rows;
}

export async function getAlerts(managerId: string, resolved?: string, client?: PoolClient) {
  let sql = `SELECT sa.*, u.first_name, u.last_name FROM system_alerts sa JOIN users u ON sa.user_id = u.id WHERE u.manager_id = $1`;
  const params: unknown[] = [managerId];
  if (resolved === "true") sql += ` AND sa.resolved = true`;
  else if (resolved === "false") sql += ` AND sa.resolved = false`;
  sql += ` ORDER BY sa.created_at DESC LIMIT 100`;
  const { rows } = await query(sql, params, client);
  return rows;
}

export async function resolveAlert(id: string, managerId: string, client?: PoolClient) {
  const result = await query(
    `UPDATE system_alerts SET resolved = true WHERE id = $1 AND user_id IN (SELECT id FROM users WHERE manager_id = $2)`,
    [id, managerId],
    client,
  );
  return (result.rowCount ?? 0) > 0;
}
