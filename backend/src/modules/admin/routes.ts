import { Router } from "express";
import multer from "multer";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";
import { findUserByEmail } from "../users/userRepository";
import { upsertSchedule } from "../schedules/repository";
import { approveAgentAndSetTempPassword, setTempPasswordForUser } from "../auth/service";
import { createNotification } from "../notifications/repository";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateJWT, requireRole(["admin"]));

router.get("/users", async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(
      `SELECT id, first_name, last_name, email, role, status, manager_id, is_approved, role_id, created_at FROM users ORDER BY created_at DESC`,
    );
    return res.json(rows);
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
    const { rows } = await query(
      `INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *`,
      [name.trim(), description?.trim() || null],
    );
    const roleId = rows[0].id;
    if (Array.isArray(permissionIds) && permissionIds.length) {
      for (const pid of permissionIds) {
        await query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [roleId, pid]);
      }
    }
    return res.status(201).json(rows[0]);
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

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get("/export/attendance", async (req: AuthRequest, res) => {
  try {
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
      const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.clock_in, r.clock_out, r.total_hours, r.is_late, r.is_early_logout, r.overtime_duration, r.shift_date].map(escapeCsv).join(","))];
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
    const from = (req.query.from as string) || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
      const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.clock_in, r.clock_out, r.overtime_duration, r.shift_date].map(String).map(escapeCsv).join(","))];
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=overtime-${from}-${to}.csv`);
      return res.send(lines.join("\r\n"));
    }
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

// Daily agents export: one row per user per day with Login, breaks, Logout, Tardy, Overtime, Leave Type, exceed flags, aux codes with time
router.get("/export/daily", async (req: AuthRequest, res) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const { rows: agents } = await query(`SELECT id, first_name, last_name FROM users WHERE role = 'agent' AND status = 'active' ORDER BY first_name, last_name`);
    const { rows: attendance } = await query(
      `SELECT a.user_id, a.shift_date, a.clock_in, a.clock_out, a.total_hours, a.is_late, a.is_early_logout, a.overtime_duration
       FROM attendance a WHERE a.shift_date >= $1 AND a.shift_date <= $2`,
      [from, to],
    );
    const { rows: schedules } = await query(
      `SELECT user_id, date, shift_start, shift_end, break_1_start, break_1_end, break_2_start, break_2_end, break_3_start, break_3_end FROM schedules WHERE date >= $1 AND date <= $2`,
      [from, to],
    );
    const { rows: auxLogs } = await query(
      `SELECT user_id, aux_type, start_time, end_time, over_limit FROM auxlogs WHERE start_time::date >= $1 AND start_time::date <= $2 ORDER BY user_id, start_time`,
      [from, to],
    );
    const { rows: leave } = await query(
      `SELECT user_id, type, start_date, end_date FROM leave_requests WHERE status = 'approved' AND start_date <= $2 AND end_date >= $1`,
      [from, to],
    );
    const header = "Date,User Name,Login,First Break In,First Break Out,Lunch In,Lunch Out,Last Break In,Last Break Out,Logout,Tardy (mins),Overtime (mins),Early Leave (mins),Leave Type,1st Break Exceed,Lunch Exceed,Last Break Exceed,NetLoginHours,PreShiftOvertime,PostShiftOvertime,OvernightEligible,TransportEligible,Aux Codes With Time";
    const lines: string[] = [header];
    const attByUserDate = new Map<string, any>();
    attendance.forEach((a: any) => attByUserDate.set(`${a.user_id}:${a.shift_date}`, a));
    const schedByUserDate = new Map<string, any>();
    schedules.forEach((s: any) => schedByUserDate.set(`${s.user_id}:${s.date}`, s));
    const auxByUserDate = new Map<string, any[]>();
    auxLogs.forEach((a: any) => {
      const d = (a.start_time as string).slice(0, 10);
      const key = `${a.user_id}:${d}`;
      if (!auxByUserDate.has(key)) auxByUserDate.set(key, []);
      auxByUserDate.get(key)!.push(a);
    });
    const leaveByUserDate = new Map<string, string>();
    leave.forEach((l: any) => {
      const start = new Date(l.start_date).getTime();
      const end = new Date(l.end_date).getTime();
      for (let t = start; t <= end; t += 86400000) {
        const d = new Date(t).toISOString().slice(0, 10);
        if (d >= from && d <= to) leaveByUserDate.set(`${l.user_id}:${d}`, l.type || "leave");
      }
    });
    const fromT = new Date(from).getTime();
    const toT = new Date(to).getTime();
    for (const u of agents as { id: string; first_name: string; last_name: string }[]) {
      for (let t = fromT; t <= toT; t += 86400000) {
        const dateStr = new Date(t).toISOString().slice(0, 10);
        const att = attByUserDate.get(`${u.id}:${dateStr}`);
        const sched = schedByUserDate.get(`${u.id}:${dateStr}`);
        const auxList = auxByUserDate.get(`${u.id}:${dateStr}`) || [];
        const leaveType = leaveByUserDate.get(`${u.id}:${dateStr}`) || (att ? "present" : "absent");
        const firstBreak = auxList.find((a: any) => a.aux_type === "break");
        const lunch = auxList.find((a: any) => a.aux_type === "lunch");
        const lastBreak = auxList.find((a: any) => a.aux_type === "last_break");
        const login = att?.clock_in ? new Date(att.clock_in).toISOString() : "";
        const logout = att?.clock_out ? new Date(att.clock_out).toISOString() : "";
        const tardyMins = att?.is_late && sched?.shift_start ? Math.max(0, Math.round((new Date(att.clock_in).getTime() - new Date(sched.shift_start).getTime()) / 60000)) : 0;
        const overtimeMins = att?.overtime_duration ? Math.round((typeof att.overtime_duration === "string" ? parseInterval(att.overtime_duration) : 0) / 60) : 0;
        const earlyMins = att?.is_early_logout && sched?.shift_end ? Math.max(0, Math.round((new Date(sched.shift_end).getTime() - new Date(att.clock_out).getTime()) / 60000)) : 0;
        const netHours = att?.total_hours ? (typeof att.total_hours === "string" ? parseInterval(att.total_hours) : 0) / 3600 : 0;
        const auxCodesWithTime = auxList.map((a: any) => `${a.aux_type} ${(a.start_time as string).slice(11, 16)}${a.end_time ? "-" + (a.end_time as string).slice(11, 16) : ""}`).join("; ");
        const overnightEligible = sched?.shift_end && new Date(sched.shift_end).getUTCHours() >= 19 ? "Y" : "";
        const transportEligible = att ? "Y" : "";
        lines.push([
          dateStr,
          `${u.first_name} ${u.last_name}`,
          login,
          firstBreak?.start_time ? (firstBreak.start_time as string).slice(11, 19) : "",
          firstBreak?.end_time ? (firstBreak.end_time as string).slice(11, 19) : "",
          lunch?.start_time ? (lunch.start_time as string).slice(11, 19) : "",
          lunch?.end_time ? (lunch.end_time as string).slice(11, 19) : "",
          lastBreak?.start_time ? (lastBreak.start_time as string).slice(11, 19) : "",
          lastBreak?.end_time ? (lastBreak.end_time as string).slice(11, 19) : "",
          logout,
          tardyMins,
          overtimeMins,
          earlyMins,
          leaveType,
          firstBreak?.over_limit ? "Y" : "",
          lunch?.over_limit ? "Y" : "",
          lastBreak?.over_limit ? "Y" : "",
          netHours.toFixed(2),
          "",
          "",
          overnightEligible,
          transportEligible,
          auxCodesWithTime,
        ].map(String).map(escapeCsv).join(","));
      }
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=daily-agents-${from}-${to}.csv`);
    return res.send(lines.join("\r\n"));
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
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
  let imported = 0;
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
    try {
      await upsertSchedule({
        userId: user.id,
        date,
        shiftStart,
        shiftEnd,
        dayType,
      });
      imported++;
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message || "Failed"}`);
    }
  }
  return res.json({ imported, errors });
});

router.put("/schedules", async (req: AuthRequest, res) => {
  const body = req.body as {
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
  const { user_id, date, shift_start, shift_end, day_type } = body;
  if (!user_id || !date) {
    return res.status(400).json({ error: { message: "user_id and date required" } });
  }
  try {
    const row = await upsertSchedule({
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
    });
    return res.json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// ——— Enterprise: Payroll export (worked hours, overtime, leave, allowances) ———
router.get("/payroll/export", async (req: AuthRequest, res) => {
  try {
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
    const totalDays = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
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
