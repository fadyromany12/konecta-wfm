import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";
import { getTeamSchedulesByManager } from "../schedules/repository";
import { createNotification } from "../notifications/repository";

const router = Router();

router.use(authenticateJWT, requireRole(["manager"]));

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
          a.overtime_duration
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
    return res.json(rows);
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

