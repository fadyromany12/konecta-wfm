import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";
import { getTeamSchedulesByManager } from "../schedules/repository";
import { createNotification } from "../notifications/repository";
import { approveAgentAndSetTempPassword, setTempPasswordForUser } from "../auth/service";

const router = Router();

// ——— Transfer requests (manager creates; manager's manager or admin approves) ———
router.get("/transfer-requests", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  const filter = (req.query.filter as string) || "pending_approval";
  try {
    if (filter === "mine") {
      const { rows } = await query(
        `SELECT r.*, a.first_name AS agent_first_name, a.last_name AS agent_last_name,
         fm.first_name AS from_manager_first_name, fm.last_name AS from_manager_last_name,
         tm.first_name AS to_manager_first_name, tm.last_name AS to_manager_last_name
         FROM reporting_line_change_requests r
         JOIN users a ON a.id = r.agent_id
         JOIN users fm ON fm.id = r.from_manager_id
         JOIN users tm ON tm.id = r.to_manager_id
         WHERE r.requested_by = $1 ORDER BY r.created_at DESC`,
        [userId]
      );
      return res.json(rows);
    }
    // pending_approval: I am the approver (from_manager's manager) or admin
    if (isAdmin) {
      const { rows } = await query(
        `SELECT r.*, a.first_name AS agent_first_name, a.last_name AS agent_last_name,
         fm.first_name AS from_manager_first_name, fm.last_name AS from_manager_last_name,
         tm.first_name AS to_manager_first_name, tm.last_name AS to_manager_last_name
         FROM reporting_line_change_requests r
         JOIN users a ON a.id = r.agent_id
         JOIN users fm ON fm.id = r.from_manager_id
         JOIN users tm ON tm.id = r.to_manager_id
         WHERE r.status = 'pending' ORDER BY r.created_at DESC`
      );
      return res.json(rows);
    }
    const { rows } = await query(
      `SELECT r.*, a.first_name AS agent_first_name, a.last_name AS agent_last_name,
       fm.first_name AS from_manager_first_name, fm.last_name AS from_manager_last_name,
       tm.first_name AS to_manager_first_name, tm.last_name AS to_manager_last_name
       FROM reporting_line_change_requests r
       JOIN users a ON a.id = r.agent_id
       JOIN users fm ON fm.id = r.from_manager_id
       JOIN users tm ON tm.id = r.to_manager_id
       WHERE r.status = 'pending' AND fm.manager_id = $1 ORDER BY r.created_at DESC`,
      [userId]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.patch("/transfer-requests/:id/approve", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const approverId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  const { id } = req.params;
  try {
    const { rows: r } = await query(
      `SELECT r.agent_id, r.from_manager_id, r.to_manager_id FROM reporting_line_change_requests r
       JOIN users fm ON fm.id = r.from_manager_id
       WHERE r.id = $1 AND r.status = 'pending'`,
      [id]
    );
    if (!r.length) return res.status(404).json({ error: { message: "Request not found or not pending" } });
    const { rows: u } = await query("SELECT manager_id FROM users WHERE id = $1", [r[0].from_manager_id]);
    const allowed = isAdmin || u[0]?.manager_id === approverId;
    if (!allowed) return res.status(403).json({ error: { message: "You cannot approve this request" } });
    await query("UPDATE users SET manager_id = $2 WHERE id = $1", [r[0].agent_id, r[0].to_manager_id]);
    await query(
      "UPDATE reporting_line_change_requests SET status = 'approved', approved_by = $2, updated_at = now() WHERE id = $1",
      [id, approverId]
    );
    return res.json({ message: "Approved" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.patch("/transfer-requests/:id/reject", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const approverId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  const { id } = req.params;
  try {
    const { rows: r } = await query(
      `SELECT r.from_manager_id FROM reporting_line_change_requests r JOIN users fm ON fm.id = r.from_manager_id WHERE r.id = $1 AND r.status = 'pending'`,
      [id]
    );
    if (!r.length) return res.status(404).json({ error: { message: "Request not found or not pending" } });
    const { rows: u } = await query("SELECT manager_id FROM users WHERE id = $1", [r[0].from_manager_id]);
    const allowed = isAdmin || (u[0]?.manager_id === approverId);
    if (!allowed) return res.status(403).json({ error: { message: "You cannot reject this request" } });
    await query(
      "UPDATE reporting_line_change_requests SET status = 'rejected', approved_by = $2, updated_at = now() WHERE id = $1",
      [id, approverId]
    );
    return res.json({ message: "Rejected" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Team list with direct manager (for hierarchy display)
router.get("/team-with-manager", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  try {
    const sql = isAdmin
      ? `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.manager_id, m.first_name AS manager_first_name, m.last_name AS manager_last_name
         FROM users u LEFT JOIN users m ON m.id = u.manager_id ORDER BY u.first_name, u.last_name`
      : `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.manager_id, m.first_name AS manager_first_name, m.last_name AS manager_last_name
         FROM users u LEFT JOIN users m ON m.id = u.manager_id WHERE u.manager_id = $1 ORDER BY u.first_name, u.last_name`;
    const { rows } = await query(sql, isAdmin ? [] : [managerId]);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Hierarchical tree (my subtree for manager; full tree for admin)
router.get("/org-tree", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  try {
    const { rows: all } = await query(
      `SELECT id, first_name, last_name, email, role, manager_id FROM users WHERE status = 'active' ORDER BY first_name, last_name`
    );
    const byManager = new Map<string | null, typeof all>();
    for (const u of all) {
      const key = u.manager_id ?? null;
      if (!byManager.has(key)) byManager.set(key, []);
      byManager.get(key)!.push(u);
    }
    const build = (managerId: string | null): any[] => {
      const children = byManager.get(managerId) || [];
      return children.map((u) => ({ ...u, children: build(u.id) }));
    };
    const root = isAdmin ? build(null) : build(userId);
    return res.json(root);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.use(authenticateJWT, requireRole(["manager"]));

// Pending agent approvals (manager sees agents who report to them and are not approved)
router.get("/pending-approvals", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  try {
    const { rows } = await query(
      `SELECT id, first_name, last_name, email, created_at FROM users WHERE manager_id = $1 AND is_approved = false AND role = 'agent' ORDER BY created_at DESC`,
      [managerId],
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/approve/:userId", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { userId } = req.params;
  try {
    const { rows } = await query(
      `SELECT id FROM users WHERE id = $1 AND manager_id = $2 AND is_approved = false`,
      [userId, managerId],
    );
    if (!rows.length) return res.status(404).json({ error: { message: "User not found or not your report" } });
    const { tempPassword } = await approveAgentAndSetTempPassword(userId);
    const { rows: u } = await query(`SELECT first_name, last_name FROM users WHERE id = $1`, [userId]);
    await createNotification(userId, "Your account has been approved. Use the temporary password your manager gave you, then change it in Profile.", "approved");
    return res.json({ message: "Approved", tempPassword, userName: u[0] ? `${u[0].first_name} ${u[0].last_name}` : "" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Approve failed" } });
  }
});

// Password reset requests (my team only)
router.get("/password-reset-requests", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  try {
    const { rows } = await query(
      `SELECT prr.id, prr.user_id, prr.requested_at, u.first_name, u.last_name, u.email
       FROM password_reset_requests prr
       JOIN users u ON u.id = prr.user_id
       WHERE u.manager_id = $1 AND prr.handled_at IS NULL ORDER BY prr.requested_at DESC`,
      [managerId],
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.post("/set-temp-password/:userId", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { userId } = req.params;
  try {
    const { rows } = await query(
      `SELECT id FROM users WHERE id = $1 AND manager_id = $2`,
      [userId, managerId],
    );
    if (!rows.length) return res.status(404).json({ error: { message: "User not found or not your report" } });
    const { tempPassword } = await setTempPasswordForUser(managerId, userId);
    await createNotification(userId, "A new temporary password has been set for you. Log in and change it in Profile.", "temp_password");
    return res.json({ message: "Temp password set", tempPassword });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// List managers + admins (for transfer target dropdown)
router.get("/managers-list", authenticateJWT, requireRole(["manager", "admin"]), async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(
      `SELECT id, first_name, last_name, email, role FROM users WHERE role IN ('manager', 'admin') AND status = 'active' AND id != $1 ORDER BY role, first_name, last_name`,
      [req.user!.sub]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Manager: create transfer request (transfer my report to another manager)
router.post("/transfer-request", async (req: AuthRequest, res) => {
  const fromManagerId = req.user!.sub;
  const { agentId, toManagerId } = req.body as { agentId?: string; toManagerId?: string };
  if (!agentId || !toManagerId) return res.status(400).json({ error: { message: "agentId and toManagerId required" } });
  if (agentId === toManagerId) return res.status(400).json({ error: { message: "Agent and new manager must differ" } });
  try {
    const { rows: agent } = await query(
      "SELECT id FROM users WHERE id = $1 AND manager_id = $2",
      [agentId, fromManagerId]
    );
    if (!agent.length) return res.status(404).json({ error: { message: "Agent not in your team" } });
    const { rows: toM } = await query("SELECT id FROM users WHERE id = $1 AND role IN ('manager','admin')", [toManagerId]);
    if (!toM.length) return res.status(400).json({ error: { message: "Target must be a manager" } });
    const { rows } = await query(
      `INSERT INTO reporting_line_change_requests (agent_id, from_manager_id, to_manager_id, requested_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [agentId, fromManagerId, toManagerId, fromManagerId]
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Team summary: aux counts and leave counts for my team (for dashboard)
router.get("/team-summary", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  try {
    const { rows: auxRows } = await query(
      `SELECT al.aux_type, COUNT(*) AS cnt FROM auxlogs al
       JOIN users u ON u.id = al.user_id
       WHERE u.manager_id = $1 AND al.start_time::date >= $2 AND al.start_time::date <= $3
       GROUP BY al.aux_type`,
      [managerId, from, to],
    );
    const { rows: leaveRows } = await query(
      `SELECT lr.type, COUNT(*) AS cnt FROM leave_requests lr
       JOIN users u ON u.id = lr.user_id
       WHERE u.manager_id = $1 AND lr.status = 'approved' AND lr.start_date <= $3 AND lr.end_date >= $2
       GROUP BY lr.type`,
      [managerId, from, to],
    );
    const auxCounts: Record<string, number> = {};
    auxRows.forEach((r: any) => { auxCounts[r.aux_type] = Number(r.cnt) || 0; });
    const leaveCounts: Record<string, number> = {};
    leaveRows.forEach((r: any) => { leaveCounts[r.type] = Number(r.cnt) || 0; });
    return res.json({ aux: auxCounts, leave: leaveCounts, from, to });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Live AUX today: team members currently on an AUX code (open session) with since when
router.get("/team-aux-today", authenticateJWT, requireRole(["manager"]), async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await query(
      `SELECT u.id AS user_id, u.first_name, u.last_name, al.aux_type, al.start_time
       FROM auxlogs al
       JOIN users u ON u.id = al.user_id
       WHERE u.manager_id = $1 AND al.start_time::date = $2 AND al.end_time IS NULL
       ORDER BY al.start_time`,
      [managerId, today],
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// List team members (users where manager_id = current user)
router.get("/team", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  try {
    const { rows } = await query(
      `
        SELECT id, first_name, last_name, email, role, status, created_at
        FROM users
        WHERE manager_id = $1
        ORDER BY first_name, last_name
      `,
      [managerId],
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch team failed" } });
  }
});

// Team attendance overview
router.get("/attendance/team", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { date } = req.query as { date?: string };
  const targetDate = date || new Date().toISOString().slice(0, 10);

  try {
    const { rows } = await query(
      `
        SELECT
          u.id AS user_id,
          u.first_name,
          u.last_name,
          a.clock_in,
          a.clock_out,
          a.total_hours,
          a.is_late,
          a.is_early_logout,
          a.overtime_duration,
          a.work_location
        FROM users u
        LEFT JOIN attendance a
          ON a.user_id = u.id
         AND a.shift_date = $2
        WHERE u.manager_id = $1
        ORDER BY u.first_name, u.last_name
      `,
      [managerId, targetDate],
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch team attendance failed" } });
  }
});

// Pending leave requests for team
function toDateOnly(v: string | Date | null | undefined): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : (v as Date).toISOString?.() ?? String(v);
  return s.slice(0, 10);
}

function escapeCsv(v: any): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Manager reports: CSV exports for my team only
router.get("/export/attendance", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await query(
      `SELECT a.id, u.first_name, u.last_name, u.email, a.clock_in, a.clock_out, a.total_hours, a.is_late, a.is_early_logout, a.overtime_duration, a.shift_date
       FROM attendance a JOIN users u ON u.id = a.user_id
       WHERE u.manager_id = $1 AND a.clock_in::date >= $2 AND a.clock_in::date <= $3 ORDER BY a.clock_in`,
      [managerId, from, to],
    );
    const header = "id,first_name,last_name,email,clock_in,clock_out,total_hours,is_late,is_early_logout,overtime_duration,shift_date";
    const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.clock_in, r.clock_out, r.total_hours, r.is_late, r.is_early_logout, r.overtime_duration, r.shift_date].map(escapeCsv).join(","))];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=team-attendance-${from}-${to}.csv`);
    return res.send(lines.join("\r\n"));
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

router.get("/export/leave", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const from = (req.query.from as string) || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await query(
      `SELECT lr.id, u.first_name, u.last_name, u.email, lr.type, lr.start_date, lr.end_date, lr.reason, lr.status, lr.created_at
       FROM leave_requests lr JOIN users u ON u.id = lr.user_id
       WHERE u.manager_id = $1 AND lr.start_date <= $3 AND lr.end_date >= $2 ORDER BY lr.created_at`,
      [managerId, from, to],
    );
    const header = "id,first_name,last_name,email,type,start_date,end_date,reason,status,created_at";
    const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.type, r.start_date, r.end_date, r.reason, r.status, r.created_at].map(String).map(escapeCsv).join(","))];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=team-leave-${from}-${to}.csv`);
    return res.send(lines.join("\r\n"));
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

router.get("/export/aux", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await query(
      `SELECT al.id, u.first_name, u.last_name, u.email, al.aux_type, al.start_time, al.end_time, al.duration, al.over_limit
       FROM auxlogs al JOIN users u ON u.id = al.user_id
       WHERE u.manager_id = $1 AND al.start_time::date >= $2 AND al.start_time::date <= $3 ORDER BY al.start_time`,
      [managerId, from, to],
    );
    const header = "id,first_name,last_name,email,aux_type,start_time,end_time,duration,over_limit";
    const lines = [header, ...rows.map((r: any) => [r.id, r.first_name, r.last_name, r.email, r.aux_type, r.start_time, r.end_time, r.duration, r.over_limit].map(String).map(escapeCsv).join(","))];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=team-aux-${from}-${to}.csv`);
    return res.send(lines.join("\r\n"));
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Export failed" } });
  }
});

router.get("/leave/pending", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  try {
    const { rows } = await query(
      `
        SELECT lr.*, u.first_name, u.last_name
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        WHERE u.manager_id = $1
          AND lr.status = 'pending'
        ORDER BY lr.created_at DESC
      `,
      [managerId],
    );
    const normalized = rows.map((r: any) => ({ ...r, start_date: toDateOnly(r.start_date), end_date: toDateOnly(r.end_date) }));
    return res.json(normalized);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch pending leave failed" } });
  }
});

router.post("/leave/:id/approve", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { id } = req.params;
  try {
    const { rows: leaveRows } = await query<{ user_id: string }>(
      `SELECT lr.user_id FROM leave_requests lr JOIN users u ON lr.user_id = u.id WHERE lr.id = $1 AND u.manager_id = $2 AND lr.status = 'pending'`,
      [id, managerId],
    );
    if (!leaveRows.length) {
      return res.status(404).json({ error: { message: "Leave request not found or not in your team" } });
    }
    const userId = leaveRows[0].user_id;
    await query(
      `UPDATE leave_requests SET status = 'approved', approved_by = $2 WHERE id = $1`,
      [id, managerId],
    );
    await createNotification(userId, "Your leave request has been approved.", "leave_approved");
    return res.json({ message: "Leave approved" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Approve leave failed" } });
  }
});

router.post("/leave/:id/reject", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { id } = req.params;
  try {
    const { rows: leaveRows } = await query<{ user_id: string }>(
      `SELECT lr.user_id FROM leave_requests lr JOIN users u ON lr.user_id = u.id WHERE lr.id = $1 AND u.manager_id = $2 AND lr.status = 'pending'`,
      [id, managerId],
    );
    if (!leaveRows.length) {
      return res.status(404).json({ error: { message: "Leave request not found or not in your team" } });
    }
    const userId = leaveRows[0].user_id;
    await query(
      `UPDATE leave_requests SET status = 'rejected', approved_by = $2 WHERE id = $1`,
      [id, managerId],
    );
    await createNotification(userId, "Your leave request has been rejected.", "leave_rejected");
    return res.json({ message: "Leave rejected" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Reject leave failed" } });
  }
});

router.get("/schedule/team", async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) {
    return res.status(400).json({ error: { message: "Query from and to (YYYY-MM-DD) required" } });
  }
  try {
    const list = await getTeamSchedulesByManager(req.user!.sub, from, to);
    return res.json(list);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed to fetch schedule" } });
  }
});

// Manager: add coaching/meeting for a team member
router.post("/schedule-activities", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id, activity_date, type, start_at, end_at, title, notes } = req.body as {
    user_id?: string;
    activity_date?: string;
    type?: string;
    start_at?: string;
    end_at?: string;
    title?: string;
    notes?: string;
  };
  if (!user_id || !activity_date || !type || !start_at || !end_at) {
    return res.status(400).json({ error: { message: "user_id, activity_date, type, start_at, end_at required" } });
  }
  if (!["coaching", "meeting", "training"].includes(type)) {
    return res.status(400).json({ error: { message: "type must be coaching, meeting, or training" } });
  }
  try {
    const { rows: u } = await query("SELECT id FROM users WHERE id = $1 AND manager_id = $2", [user_id, managerId]);
    if (!u.length) return res.status(403).json({ error: { message: "Agent not in your team" } });
    const { rows } = await query(
      `INSERT INTO schedule_activities (user_id, activity_date, type, start_at, end_at, title, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [user_id, activity_date, type, start_at, end_at, title ?? null, notes ?? null, managerId],
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// ——— Enterprise: Manager notes ———
router.get("/notes", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const userId = req.query.user_id as string | undefined;
  try {
    let sql = `SELECT mn.*, u.first_name, u.last_name FROM manager_notes mn JOIN users u ON mn.user_id = u.id WHERE mn.manager_id = $1`;
    const params: string[] = [managerId];
    if (userId) {
      params.push(userId);
      sql += ` AND mn.user_id = $2`;
    }
    sql += ` ORDER BY mn.created_at DESC`;
    const { rows } = await query(sql, params);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch notes failed" } });
  }
});

router.post("/notes", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id, note_type, content } = req.body as { user_id?: string; note_type?: string; content?: string };
  if (!user_id || !content) {
    return res.status(400).json({ error: { message: "user_id and content required" } });
  }
  try {
    const { rows } = await query(
      `INSERT INTO manager_notes (user_id, manager_id, note_type, content) VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, managerId, note_type || "general", content],
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Add note failed" } });
  }
});

// ——— Enterprise: Disciplinary ———
router.get("/disciplinary", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const userId = req.query.user_id as string | undefined;
  try {
    let sql = `SELECT d.*, u.first_name, u.last_name FROM disciplinary_actions d JOIN users u ON d.user_id = u.id WHERE d.manager_id = $1`;
    const params: string[] = [managerId];
    if (userId) {
      params.push(userId);
      sql += ` AND d.user_id = $2`;
    }
    sql += ` ORDER BY d.created_at DESC`;
    const { rows } = await query(sql, params);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch disciplinary failed" } });
  }
});

router.post("/disciplinary", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { user_id, action_type, description, severity } = req.body as { user_id?: string; action_type?: string; description?: string; severity?: string };
  if (!user_id || !action_type) {
    return res.status(400).json({ error: { message: "user_id and action_type required" } });
  }
  try {
    const { rows } = await query(
      `INSERT INTO disciplinary_actions (user_id, manager_id, action_type, description, severity) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, managerId, action_type, description || null, severity || "warning"],
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Add disciplinary failed" } });
  }
});

// ——— Enterprise: Team attendance scores (ranking) ———
router.get("/scores", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const period = (req.query.period as string) || "week";
  const today = new Date();
  let periodStart: string;
  let periodEnd: string;
  if (period === "month") {
    periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    periodEnd = today.toISOString().slice(0, 10);
  } else {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    periodStart = d.toISOString().slice(0, 10);
    periodEnd = today.toISOString().slice(0, 10);
  }
  try {
    const { rows } = await query(
      `
      SELECT user_id, period_start, period_end, punctuality_score, break_compliance, overtime_score, absence_ratio, overall_score
      FROM attendance_scores
      WHERE user_id IN (SELECT id FROM users WHERE manager_id = $1)
        AND period_start = $2 AND period_end = $3
      ORDER BY overall_score DESC NULLS LAST
      `,
      [managerId, periodStart, periodEnd],
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch scores failed" } });
  }
});

// ——— Enterprise: Alerts (for my team) ———
router.get("/alerts", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const resolved = req.query.resolved as string | undefined;
  try {
    let sql = `
      SELECT sa.*, u.first_name, u.last_name FROM system_alerts sa
      JOIN users u ON sa.user_id = u.id
      WHERE u.manager_id = $1
    `;
    const params: any[] = [managerId];
    if (resolved === "true") {
      sql += ` AND sa.resolved = true`;
    } else if (resolved === "false") {
      sql += ` AND sa.resolved = false`;
    }
    sql += ` ORDER BY sa.created_at DESC LIMIT 100`;
    const { rows } = await query(sql, params);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Fetch alerts failed" } });
  }
});

router.patch("/alerts/:id/resolve", async (req: AuthRequest, res) => {
  const managerId = req.user!.sub;
  const { id } = req.params;
  try {
    const { rowCount } = await query(
      `UPDATE system_alerts SET resolved = true WHERE id = $1 AND user_id IN (SELECT id FROM users WHERE manager_id = $2)`,
      [id, managerId],
    );
    if ((rowCount ?? 0) === 0) return res.status(404).json({ error: { message: "Alert not found" } });
    return res.json({ message: "Resolved" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Resolve failed" } });
  }
});

export default router;

