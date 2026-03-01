import { Router } from "express";
import multer from "multer";
import QueryStream from "pg-query-stream";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query, runInTransaction, pool } from "../../db/pool";
import { findUserByEmail } from "../users/userRepository";
import { upsertSchedule, updateSchedule, batchUpsertSchedules } from "../schedules/repository";
import { approveAgentAndSetTempPassword, setTempPasswordForUser } from "../auth/service";
import { createNotification } from "../notifications/repository";
import { getOpenAuxForUser, closeAux, createAux } from "../auxlogs/repository";
import { dateRangeArray, daysAgo } from "../../utils/dateHelpers";
import { getBalance, getBalancesForUser, setBalance } from "../leaveBalances/repository";
import { hasLockedAttendanceForUserAndDate, getAttendanceById } from "../attendance/repository";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateJWT, requireRole(["admin"]));

router.get("/users", async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 100), 500);
    const offset = (page - 1) * limit;
    const { rows } = await query(
      `SELECT id, first_name, last_name, email, role, status, manager_id, is_approved, role_id, created_at, offboarded_at, offboarding_reason FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const { rows: countRows } = await query<{ count: string }>(`SELECT count(*) AS count FROM users`);
    const total = parseInt(countRows[0]?.count ?? "0", 10);
    return res.json({ data: rows, total });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/users/:id/offboard", async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body as { reason?: string };
  try {
    const { rowCount } = await query(
      `UPDATE users SET status = 'inactive', offboarded_at = now(), offboarding_reason = $2, updated_at = now() WHERE id = $1 AND role = 'agent'`,
      [id, reason ?? null],
    );
    if ((rowCount ?? 0) === 0) return res.status(404).json({ error: { message: "Agent not found" } });
    return res.json({ message: "Agent offboarded" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Offboard failed" } });
  }
});

router.get("/leave-balances", async (req: AuthRequest, res) => {
  const user_id = req.query.user_id as string;
  const year = Number(req.query.year) || new Date().getFullYear();
  if (!user_id) return res.status(400).json({ error: { message: "user_id required" } });
  try {
    const rows = await getBalancesForUser(user_id, year);
    return res.json({ year, items: rows });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/leave-balances", async (req: AuthRequest, res) => {
  const { user_id, year, leave_type, balance, used } = req.body as { user_id?: string; year?: number; leave_type?: string; balance?: number; used?: number };
  if (!user_id || !year || !leave_type) return res.status(400).json({ error: { message: "user_id, year, leave_type required" } });
  if (!["annual", "sick"].includes(leave_type)) return res.status(400).json({ error: { message: "leave_type must be annual or sick" } });
  try {
    await setBalance(user_id, year, leave_type, Number(balance) || 0, Number(used) || 0);
    const row = await getBalance(user_id, year, leave_type);
    return res.json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Pending approvals (all unapproved agents)
router.get("/pending-approvals", async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.manager_id, u.created_at, m.first_name AS manager_first_name, m.last_name AS manager_last_name
       FROM users u LEFT JOIN users m ON m.id = u.manager_id
       WHERE u.is_approved = false AND u.role = 'agent' ORDER BY u.created_at DESC`,
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/approve/:userId", async (req: AuthRequest, res) => {
  const adminId = req.user!.sub;
  const { userId } = req.params;
  try {
    const { tempPassword } = await approveAgentAndSetTempPassword(userId);
    await createNotification(userId, "Your account has been approved. Use the temporary password provided by admin/manager, then change it in Profile.", "approved");
    return res.json({ message: "Approved", tempPassword });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Approve failed" } });
  }
});

router.get("/password-reset-requests", async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(
      `SELECT prr.id, prr.user_id, prr.requested_at, u.first_name, u.last_name, u.email
       FROM password_reset_requests prr JOIN users u ON u.id = prr.user_id
       WHERE prr.handled_at IS NULL ORDER BY prr.requested_at DESC`,
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/set-temp-password/:userId", async (req: AuthRequest, res) => {
  const adminId = req.user!.sub;
  const { userId } = req.params;
  try {
    const { tempPassword } = await setTempPasswordForUser(adminId, userId);
    await createNotification(userId, "A new temporary password has been set. Log in and change it in Profile.", "temp_password");
    return res.json({ message: "Temp password set", tempPassword });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Roles and permissions
router.get("/roles", async (req: AuthRequest, res) => {
  try {
    const { rows: roles } = await query(
      `SELECT id, name, description, created_at FROM roles ORDER BY name`,
    );
    const { rows: perms } = await query(`SELECT id, key, label, category FROM permissions ORDER BY category, key`);
    const { rows: rp } = await query(`SELECT role_id, permission_id FROM role_permissions`);
    const byRole: Record<string, string[]> = {};
    rp.forEach((r: any) => {
      if (!byRole[r.role_id]) byRole[r.role_id] = [];
      byRole[r.role_id].push(r.permission_id);
    });
    return res.json({ roles, permissions: perms, rolePermissions: byRole });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/roles", async (req: AuthRequest, res) => {
  const { name, description, permissionIds } = req.body as { name?: string; description?: string; permissionIds?: string[] };
  if (!name?.trim()) return res.status(400).json({ error: { message: "name required" } });
  try {
    const row = await runInTransaction(async (client) => {
      const { rows } = await query(
        `INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *`,
        [name.trim(), description?.trim() || null],
        client,
      );
      const roleId = rows[0].id;
      if (Array.isArray(permissionIds) && permissionIds.length) {
        for (const pid of permissionIds) {
          await query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [roleId, pid], client);
        }
      }
      return rows[0];
    });
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.put("/roles/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, description, permissionIds } = req.body as { name?: string; description?: string; permissionIds?: string[] };
  try {
    if (name?.trim()) await query(`UPDATE roles SET name = $2, description = $3 WHERE id = $1`, [id, name.trim(), description?.trim() ?? null]);
    await query(`DELETE FROM role_permissions WHERE role_id = $1`, [id]);
    if (Array.isArray(permissionIds) && permissionIds.length) {
      for (const pid of permissionIds) {
        await query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`, [id, pid]);
      }
    }
    const { rows } = await query(`SELECT * FROM roles WHERE id = $1`, [id]);
    return res.json(rows[0] || {});
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.patch("/users/:userId/role", async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { roleId } = req.body as { roleId?: string };
  if (!roleId) return res.status(400).json({ error: { message: "roleId required" } });
  try {
    const { rows } = await query(
      `UPDATE users SET role_id = $2, role = (SELECT name FROM roles WHERE id = $2) WHERE id = $1 RETURNING id, role, role_id`,
      [userId, roleId],
    );
    if (!rows.length) return res.status(404).json({ error: { message: "User not found" } });
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.get("/audit", async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const { rows } = await query(
      `SELECT id, action, user_id, metadata, ip, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const { rows: countRows } = await query<{ count: string }>(`SELECT count(*) AS count FROM audit_logs`);
    const total = parseInt(countRows[0]?.count ?? "0", 10);
    return res.json({ items: rows, total });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Manual punch and corrections (admin, manager, RTA can fix agent attendance and AUX)
router.post("/attendance/manual", async (req: AuthRequest, res) => {
  const { user_id, clock_in, clock_out } = req.body as { user_id?: string; clock_in?: string; clock_out?: string };
  if (!user_id || !clock_in) return res.status(400).json({ error: { message: "user_id and clock_in required" } });
  const dateStr = clock_in.slice(0, 10);
  const locked = await hasLockedAttendanceForUserAndDate(user_id, dateStr);
  if (locked) return res.status(400).json({ error: { message: "Timesheet for this date is locked; cannot add punch." } });
  try {
    const clockInDate = new Date(clock_in);
    const clockOutDate = clock_out ? new Date(clock_out) : null;
    const workedSeconds = clockOutDate ? Math.max(0, Math.floor((clockOutDate.getTime() - clockInDate.getTime()) / 1000)) : 0;
    const totalHours = `${workedSeconds} seconds`;
    const { rows } = await query(
      `INSERT INTO attendance (user_id, clock_in, clock_out, total_hours, is_late, is_early_logout, overtime_duration)
       VALUES ($1, $2, $3, $4::interval, false, false, '0 seconds'::interval) RETURNING *`,
      [user_id, clock_in, clock_out || null, totalHours],
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Manual punch failed" } });
  }
});

router.patch("/attendance/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { clock_in, clock_out } = req.body as { clock_in?: string; clock_out?: string };
  if (!clock_in && !clock_out) return res.status(400).json({ error: { message: "clock_in or clock_out required" } });
  const att = await getAttendanceById(id);
  if (!att) return res.status(404).json({ error: { message: "Attendance not found" } });
  if (att.timesheet_approved) return res.status(400).json({ error: { message: "Timesheet is locked; cannot edit." } });
  try {
    const cin = clock_in ? new Date(clock_in) : new Date(att.clock_in);
    const cout = clock_out !== undefined ? (clock_out ? new Date(clock_out) : null) : (att.clock_out ? new Date(att.clock_out) : null);
    const workedSeconds = cout ? Math.max(0, Math.floor((cout.getTime() - cin.getTime()) / 1000)) : 0;
    const totalHours = `${workedSeconds} seconds`;
    const { rows } = await query(
      `UPDATE attendance SET clock_in = $2, clock_out = $3, total_hours = $4::interval WHERE id = $1 RETURNING *`,
      [id, cin.toISOString(), cout?.toISOString() ?? null, totalHours],
    );
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Update failed" } });
  }
});

router.post("/aux/end-for-agent", async (req: AuthRequest, res) => {
  const { user_id } = req.body as { user_id?: string };
  if (!user_id) return res.status(400).json({ error: { message: "user_id required" } });
  try {
    const open = await getOpenAuxForUser(user_id);
    if (!open) return res.status(404).json({ error: { message: "No open AUX for this agent" } });
    const end = new Date();
    const start = new Date(open.start_time);
    const durationSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    await closeAux({ id: open.id, end, durationSeconds, overLimit: false });
    return res.json({ message: "AUX ended" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/aux/start-for-agent", async (req: AuthRequest, res) => {
  const { user_id, aux_type } = req.body as { user_id?: string; aux_type?: string };
  if (!user_id || !aux_type) return res.status(400).json({ error: { message: "user_id and aux_type required" } });
  const allowed = ["break", "lunch", "last_break", "meeting", "coaching", "training", "technical_issue", "floor_support", "available"];
  if (!allowed.includes(aux_type)) return res.status(400).json({ error: { message: "Invalid aux_type" } });
  try {
    const open = await getOpenAuxForUser(user_id);
    if (open) return res.status(400).json({ error: { message: "Agent already has an open AUX. End it first." } });
    const aux = await createAux(user_id, aux_type as any, new Date());
    return res.status(201).json(aux);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Format PostgreSQL interval (string or object) for CSV to avoid [object Object]. */
function formatIntervalForCsv(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "hours" in v) {
    const o = v as { hours?: number; minutes?: number; seconds?: number };
    const h = o.hours ?? 0;
    const m = o.minutes ?? 0;
    const s = o.seconds ?? 0;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return String(v);
}

router.get("/export/attendance", async (req: AuthRequest, res) => {
  try {
    const from = (req.query.from as string) || daysAgo(30);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const format = (req.query.format as string) || "csv";
    const { rows } = await query(
      `SELECT a.id, u.first_name, u.last_name, u.email, a.clock_in, a.clock_out, a.total_hours, a.is_late, a.is_early_logout, a.overtime_duration, a.shift_date
       FROM attendance a
       JOIN users u ON u.id = a.user_id
       WHERE a.clock_in::date >= $1 AND a.clock_in::date <= $2
       ORDER BY a.clock_in`,
      [from, to],
    );
    if (format === "csv") {
      const header = "id,first_name,last_name,email,clock_in,clock_out,total_hours,is_late,is_early_logout,overtime_duration,shift_date";
      const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.clock_in, r.clock_out, formatIntervalForCsv(r.total_hours), r.is_late, r.is_early_logout, formatIntervalForCsv(r.overtime_duration), r.shift_date].map(String).map(escapeCsv).join(","))];
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=attendance-${from}-${to}.csv`);
      return res.send(lines.join("\r\n"));
    }
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

router.get("/export/leave", async (req: AuthRequest, res) => {
  try {
    const from = (req.query.from as string) || daysAgo(90);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const format = (req.query.format as string) || "csv";
    const { rows } = await query(
      `SELECT lr.id, u.first_name, u.last_name, u.email, lr.type, lr.start_date, lr.end_date, lr.reason, lr.status, lr.created_at
       FROM leave_requests lr
       JOIN users u ON u.id = lr.user_id
       WHERE lr.start_date <= $2 AND lr.end_date >= $1
       ORDER BY lr.created_at`,
      [from, to],
    );
    if (format === "csv") {
      const header = "id,first_name,last_name,email,type,start_date,end_date,reason,status,created_at";
      const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.type, r.start_date, r.end_date, r.reason, r.status, r.created_at].map(String).map(escapeCsv).join(","))];
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=leave-${from}-${to}.csv`);
      return res.send(lines.join("\r\n"));
    }
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

router.get("/export/aux", async (req: AuthRequest, res) => {
  try {
    const from = (req.query.from as string) || daysAgo(30);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const format = (req.query.format as string) || "csv";
    const { rows } = await query(
      `SELECT al.id, u.first_name, u.last_name, u.email, al.aux_type, al.start_time, al.end_time, al.duration, al.over_limit, al.created_at
       FROM auxlogs al
       JOIN users u ON u.id = al.user_id
       WHERE al.start_time::date >= $1 AND al.start_time::date <= $2
       ORDER BY al.start_time`,
      [from, to],
    );
    if (format === "csv") {
      const header = "id,first_name,last_name,email,aux_type,start_time,end_time,duration,over_limit,created_at";
      const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.aux_type, r.start_time, r.end_time, r.duration, r.over_limit, r.created_at].map(String).map(escapeCsv).join(","))];
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=aux-${from}-${to}.csv`);
      return res.send(lines.join("\r\n"));
    }
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

router.get("/export/overtime", async (req: AuthRequest, res) => {
  try {
    const from = (req.query.from as string) || daysAgo(30);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const format = (req.query.format as string) || "csv";
    const { rows } = await query(
      `SELECT a.id, u.first_name, u.last_name, u.email, a.clock_in, a.clock_out, a.overtime_duration, a.shift_date
       FROM attendance a
       JOIN users u ON u.id = a.user_id
       WHERE a.clock_in::date >= $1 AND a.clock_in::date <= $2 AND a.overtime_duration IS NOT NULL AND a.overtime_duration > interval '0'
       ORDER BY a.clock_in`,
      [from, to],
    );
    if (format === "csv") {
      const header = "id,first_name,last_name,email,clock_in,clock_out,overtime_duration,shift_date";
      const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.clock_in, r.clock_out, formatIntervalForCsv(r.overtime_duration), r.shift_date].map(String).map(escapeCsv).join(","))];
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=overtime-${from}-${to}.csv`);
      return res.send(lines.join("\r\n"));
    }
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

// Daily agents export: stream one row per user per day (no in-memory aggregation; uses pg-query-stream).
const DAILY_EXPORT_SQL = `
WITH agents AS (SELECT id AS user_id, first_name, last_name FROM users WHERE role = 'agent' AND status = 'active'),
     dates AS (SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS date_str),
     grid AS (SELECT a.user_id, a.first_name, a.last_name, d.date_str FROM agents a CROSS JOIN dates d),
     att AS (SELECT user_id, shift_date AS date_str, clock_in, clock_out, total_hours, is_late, is_early_logout, overtime_duration FROM attendance WHERE shift_date >= $1 AND shift_date <= $2),
     sched AS (SELECT user_id, date AS date_str, shift_start, shift_end FROM v_effective_schedules WHERE date >= $1 AND date <= $2),
     leave_expanded AS (SELECT lr.user_id, g.d::date AS date_str, lr.type AS leave_type FROM leave_requests lr CROSS JOIN LATERAL generate_series(lr.start_date, lr.end_date, '1 day'::interval) g(d) WHERE lr.status = 'approved'),
     leave_agg AS (SELECT user_id, date_str, max(leave_type) AS leave_type FROM leave_expanded WHERE date_str >= $1 AND date_str <= $2 GROUP BY user_id, date_str),
     aux_agg AS (SELECT user_id, start_time::date AS date_str,
       min(start_time) FILTER (WHERE aux_type = 'break') AS first_break_start, max(end_time) FILTER (WHERE aux_type = 'break') AS first_break_end,
       min(start_time) FILTER (WHERE aux_type = 'lunch') AS lunch_start, max(end_time) FILTER (WHERE aux_type = 'lunch') AS lunch_end,
       min(start_time) FILTER (WHERE aux_type = 'last_break') AS last_break_start, max(end_time) FILTER (WHERE aux_type = 'last_break') AS last_break_end,
       bool_or(over_limit) FILTER (WHERE aux_type = 'break') AS first_break_over_limit,
       bool_or(over_limit) FILTER (WHERE aux_type = 'lunch') AS lunch_over_limit,
       bool_or(over_limit) FILTER (WHERE aux_type = 'last_break') AS last_break_over_limit,
       string_agg(aux_type || ' ' || to_char(start_time, 'HH24:MI') || CASE WHEN end_time IS NOT NULL THEN '-' || to_char(end_time, 'HH24:MI') ELSE '' END, '; ' ORDER BY start_time) AS aux_codes
       FROM auxlogs WHERE start_time::date >= $1 AND start_time::date <= $2 GROUP BY user_id, start_time::date)
SELECT to_char(grid.date_str, 'YYYY-MM-DD') AS date_str, grid.first_name, grid.last_name,
  att.clock_in, att.clock_out, sched.shift_start, sched.shift_end, att.total_hours, att.is_late, att.is_early_logout, att.overtime_duration,
  leave_agg.leave_type,
  aux_agg.first_break_start, aux_agg.first_break_end, aux_agg.lunch_start, aux_agg.lunch_end, aux_agg.last_break_start, aux_agg.last_break_end,
  aux_agg.first_break_over_limit, aux_agg.lunch_over_limit, aux_agg.last_break_over_limit, aux_agg.aux_codes
FROM grid
LEFT JOIN att ON att.user_id = grid.user_id AND att.date_str = grid.date_str
LEFT JOIN sched ON sched.user_id = grid.user_id AND sched.date_str = grid.date_str
LEFT JOIN leave_agg ON leave_agg.user_id = grid.user_id AND leave_agg.date_str = grid.date_str
LEFT JOIN aux_agg ON aux_agg.user_id = grid.user_id AND aux_agg.date_str = grid.date_str
ORDER BY grid.first_name, grid.last_name, grid.date_str
`;

router.get("/export/daily", async (req: AuthRequest, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = (req.query.from as string)?.trim() || today;
  const to = (req.query.to as string)?.trim() || today;
  const header = "Date,User Name,Login,First Break In,First Break Out,Lunch In,Lunch Out,Last Break In,Last Break Out,Logout,Tardy (mins),Overtime (mins),Early Leave (mins),Leave Type,1st Break Exceed,Lunch Exceed,Last Break Exceed,NetLoginHours,PreShiftOvertime,PostShiftOvertime,OvernightEligible,TransportEligible,Aux Codes With Time";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=daily-agents-${from}-${to}.csv`);
  res.write(header + "\r\n");

  let client;
  try {
    client = await pool.connect();
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
  const stream = client.query(new QueryStream(DAILY_EXPORT_SQL, [from, to]));

  stream.on("data", (row: any) => {
    const dateStr = row.date_str ?? "";
    const userName = [row.first_name, row.last_name].filter(Boolean).join(" ");
    const login = row.clock_in ? new Date(row.clock_in).toISOString() : "";
    const logout = row.clock_out ? new Date(row.clock_out).toISOString() : "";
    const tardyMins = row.is_late && row.shift_start ? Math.max(0, Math.round((new Date(row.clock_in).getTime() - new Date(row.shift_start).getTime()) / 60000)) : 0;
    const totalHoursStr = row.total_hours != null ? String(row.total_hours) : "";
    const totalHoursSec = totalHoursStr ? parseInterval(totalHoursStr) : 0;
    const overtimeMins = row.overtime_duration != null ? Math.round(parseInterval(String(row.overtime_duration)) / 60) : 0;
    const earlyMins = row.is_early_logout && row.shift_end && row.clock_out ? Math.max(0, Math.round((new Date(row.shift_end).getTime() - new Date(row.clock_out).getTime()) / 60000)) : 0;
    const leaveType = row.leave_type || (row.clock_in ? "present" : "absent");
    const netHours = (totalHoursSec / 3600).toFixed(2);
    const fbStart = row.first_break_start ? String(row.first_break_start).slice(11, 19) : "";
    const fbEnd = row.first_break_end ? String(row.first_break_end).slice(11, 19) : "";
    const lunchStart = row.lunch_start ? String(row.lunch_start).slice(11, 19) : "";
    const lunchEnd = row.lunch_end ? String(row.lunch_end).slice(11, 19) : "";
    const lbStart = row.last_break_start ? String(row.last_break_start).slice(11, 19) : "";
    const lbEnd = row.last_break_end ? String(row.last_break_end).slice(11, 19) : "";
    const overnightEligible = row.shift_end && new Date(row.shift_end).getUTCHours() >= 19 ? "Y" : "";
    const transportEligible = row.clock_in ? "Y" : "";
    const line = [dateStr, userName, login, fbStart, fbEnd, lunchStart, lunchEnd, lbStart, lbEnd, logout, tardyMins, overtimeMins, earlyMins, leaveType, row.first_break_over_limit ? "Y" : "", row.lunch_over_limit ? "Y" : "", row.last_break_over_limit ? "Y" : "", netHours, "", "", overnightEligible, transportEligible, row.aux_codes ?? ""].map(String).map(escapeCsv).join(",");
    res.write(line + "\r\n");
  });
  stream.on("end", () => {
    client.release();
    res.end();
  });
  stream.on("error", (err: Error) => {
    client.release();
    if (!res.headersSent) res.status(400).json({ error: { message: err.message || "Export failed" } });
    else res.end();
  });
});

function parseInterval(s: string): number {
  const m = s.match(/(\d+):(\d+):(\d+)/);
  if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
  return 0;
}

router.get("/schedules", async (req: AuthRequest, res) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const userId = req.query.user_id as string | undefined;
    if (!from || !to) {
      return res.status(400).json({ error: { message: "from and to (YYYY-MM-DD) required" } });
    }
    let sql = `SELECT s.*, u.first_name, u.last_name, u.email FROM schedules s JOIN users u ON s.user_id = u.id WHERE s.date >= $1 AND s.date <= $2`;
    const params: any[] = [from, to];
    if (userId) {
      params.push(userId);
      sql += ` AND s.user_id = $3`;
    }
    sql += ` ORDER BY s.date, u.first_name`;
    const { rows } = await query(sql, params);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/schedules/import", upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: { message: "No file uploaded" } });
  }
  const text = req.file.buffer.toString("utf-8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return res.status(400).json({ error: { message: "CSV must have header and at least one row" } });
  }
  const header = lines[0].toLowerCase().split(",").map((s) => s.trim());
  const emailIdx = header.indexOf("email");
  const dateIdx = header.indexOf("date");
  const startIdx = header.indexOf("shift_start");
  const endIdx = header.indexOf("shift_end");
  const dayTypeIdx = header.indexOf("day_type");
  if (emailIdx < 0 || dateIdx < 0 || dayTypeIdx < 0) {
    return res.status(400).json({ error: { message: "CSV must have email, date, day_type columns" } });
  }
  const errors: string[] = [];
  const items: { userId: string; date: string; shiftStart: string | null; shiftEnd: string | null; dayType: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const email = cells[emailIdx];
    const date = cells[dateIdx];
    const shiftStart = startIdx >= 0 && cells[startIdx] ? `${date}T${cells[startIdx]}:00` : null;
    const shiftEnd = endIdx >= 0 && cells[endIdx] ? `${date}T${cells[endIdx]}:00` : null;
    const dayType = (dayTypeIdx >= 0 && cells[dayTypeIdx]) || "work";
    if (!email || !date) {
      errors.push(`Row ${i + 1}: missing email or date`);
      continue;
    }
    const user = await findUserByEmail(email);
    if (!user) {
      errors.push(`Row ${i + 1}: user not found: ${email}`);
      continue;
    }
    items.push({ userId: user.id, date, shiftStart, shiftEnd, dayType });
  }
  if (items.length === 0) {
    return res.json({ imported: 0, updated: 0, errors });
  }
  try {
    const result = await runInTransaction(async (client) => batchUpsertSchedules(items, client));
    return res.json({ imported: result.inserted, updated: result.updated, errors });
  } catch (e: any) {
    errors.push(e.message || "Batch import failed");
    return res.json({ imported: 0, updated: 0, errors });
  }
});

router.post("/schedules/batch", async (req: AuthRequest, res) => {
  const body = req.body as { schedules?: Array<{ user_id: string; date: string; shift_start?: string | null; shift_end?: string | null; day_type?: string; project_id?: string | null; break_1_start?: string | null; break_1_end?: string | null; break_2_start?: string | null; break_2_end?: string | null; break_3_start?: string | null; break_3_end?: string | null }> };
  const list = body.schedules;
  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ error: { message: "schedules array required and must not be empty" } });
  }
  const items = list.map((s) => ({
    userId: s.user_id,
    date: s.date,
    projectId: s.project_id ?? null,
    shiftStart: s.shift_start ?? null,
    shiftEnd: s.shift_end ?? null,
    break1Start: s.break_1_start ?? null,
    break1End: s.break_1_end ?? null,
    break2Start: s.break_2_start ?? null,
    break2End: s.break_2_end ?? null,
    break3Start: s.break_3_start ?? null,
    break3End: s.break_3_end ?? null,
    dayType: s.day_type || "work",
  }));
  try {
    const result = await runInTransaction((client) => batchUpsertSchedules(items, client));
    return res.json({ inserted: result.inserted, updated: result.updated });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Batch update failed" } });
  }
});

router.put("/schedules", async (req: AuthRequest, res) => {
  const body = req.body as {
    id?: string;
    version?: number;
    user_id?: string;
    date?: string;
    project_id?: string | null;
    shift_start?: string | null;
    shift_end?: string | null;
    break_1_start?: string | null;
    break_1_end?: string | null;
    break_2_start?: string | null;
    break_2_end?: string | null;
    break_3_start?: string | null;
    break_3_end?: string | null;
    day_type?: string;
  };
  const { id, version, user_id, date, shift_start, shift_end, day_type } = body;
  if (!user_id || !date) {
    return res.status(400).json({ error: { message: "user_id and date required" } });
  }
  const params = {
    userId: user_id,
    date,
    projectId: body.project_id ?? null,
    shiftStart: shift_start ?? null,
    shiftEnd: shift_end ?? null,
    break1Start: body.break_1_start ?? null,
    break1End: body.break_1_end ?? null,
    break2Start: body.break_2_start ?? null,
    break2End: body.break_2_end ?? null,
    break3Start: body.break_3_start ?? null,
    break3End: body.break_3_end ?? null,
    dayType: day_type || "work",
  };
  try {
    if (id != null && version != null) {
      const row = await updateSchedule(id, version, params);
      return res.json(row);
    }
    const row = await upsertSchedule(params);
    return res.json(row);
  } catch (err: any) {
    if (err?.message === "CONFLICT") return res.status(409).json({ error: { message: "Schedule was updated by someone else; refresh and try again." } });
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// ——— Enterprise: Payroll export (worked hours, overtime, leave, allowances) ———
router.get("/payroll/export", async (req: AuthRequest, res) => {
  try {
    const from = (req.query.from as string) || daysAgo(30);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const { rows: attendanceRows } = await query(
      `SELECT u.id AS user_id, u.first_name, u.last_name, u.email,
              COUNT(a.id) FILTER (WHERE a.clock_out IS NOT NULL) AS days_worked,
              SUM(EXTRACT(EPOCH FROM a.total_hours) / 3600) AS regular_hours,
              SUM(EXTRACT(EPOCH FROM a.overtime_duration) / 3600) AS overtime_hours
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id AND a.shift_date >= $1 AND a.shift_date <= $2
       WHERE u.role = 'agent'
       GROUP BY u.id, u.first_name, u.last_name, u.email`,
      [from, to],
    );
    const { rows: leaveRows } = await query(
      `SELECT user_id, type, SUM((end_date - start_date + 1)) AS days
       FROM leave_requests WHERE status = 'approved' AND start_date <= $2 AND end_date >= $1 GROUP BY user_id, type`,
      [from, to],
    );
    const { rows: schedRows } = await query(
      `SELECT user_id, COUNT(*) FILTER (WHERE day_type = 'off') AS days_off,
              COUNT(*) FILTER (WHERE day_type = 'holiday') AS holiday_days
       FROM schedules WHERE date >= $1 AND date <= $2 GROUP BY user_id`,
      [from, to],
    );
    const leaveMap: Record<string, { total: number; sick: number }> = {};
    leaveRows.forEach((r: any) => {
      if (!leaveMap[r.user_id]) leaveMap[r.user_id] = { total: 0, sick: 0 };
      leaveMap[r.user_id].total += Number(r.days) || 0;
      if (String(r.type).toLowerCase().includes("sick")) leaveMap[r.user_id].sick += Number(r.days) || 0;
    });
    const schedMap: Record<string, { days_off: number; holiday: number }> = {};
    schedRows.forEach((r: any) => { schedMap[r.user_id] = { days_off: Number(r.days_off) || 0, holiday: Number(r.holiday_days) || 0 }; });
    const totalDays = dateRangeArray(from, to).length;
    const csvHeader = "user_id,first_name,last_name,email,period_start,period_end,days_worked,days_off,days_sick,regular_hours,overtime_hours,overtime_day_hours,overtime_night_hours,leave_days,cancel_day_offs,transportation_allowance_days,overnight_allowance_days";
    const csvLines = attendanceRows.map((r: any) => {
      const uid = r.user_id;
      const worked = Number(r.days_worked) || 0;
      const off = schedMap[uid]?.days_off ?? 0;
      const sick = leaveMap[uid]?.sick ?? 0;
      const leaveDays = leaveMap[uid]?.total ?? 0;
      return [
        uid,
        r.first_name,
        r.last_name,
        r.email,
        from,
        to,
        worked,
        off,
        sick,
        (Number(r.regular_hours) || 0).toFixed(2),
        (Number(r.overtime_hours) || 0).toFixed(2),
        (Number(r.overtime_hours) || 0).toFixed(2),
        "0",
        leaveDays,
        0,
        worked,
        worked,
      ].map(String).map(escapeCsv).join(",");
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=payroll-${from}-${to}.csv`);
    return res.send([csvHeader, ...csvLines].join("\r\n"));
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Payroll export failed" } });
  }
});

// ——— Enterprise: System alerts (admin) ———
router.get("/alerts", async (req: AuthRequest, res) => {
  try {
    const resolved = req.query.resolved as string | undefined;
    let sql = `SELECT sa.*, u.first_name, u.last_name, u.email FROM system_alerts sa LEFT JOIN users u ON sa.user_id = u.id WHERE 1=1`;
    const params: any[] = [];
    if (resolved === "true") { sql += ` AND sa.resolved = true`; }
    else if (resolved === "false") { sql += ` AND sa.resolved = false`; }
    sql += ` ORDER BY sa.created_at DESC LIMIT 200`;
    const { rows } = await query(sql, params);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.patch("/alerts/:id/resolve", async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(`UPDATE system_alerts SET resolved = true WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: { message: "Alert not found" } });
    return res.json({ message: "Resolved" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
