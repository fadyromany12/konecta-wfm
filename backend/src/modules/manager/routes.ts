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

export default router;

