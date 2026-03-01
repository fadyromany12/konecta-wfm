import { Router } from "express";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";
import { query } from "../../db/pool";
import { upsertSchedule } from "../schedules/repository";

const router = Router();
router.use(authenticateJWT, requireRole(["rta", "admin"]));

function canAccessProject(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === "admin") return Promise.resolve(true);
  return query("SELECT 1 FROM rta_projects WHERE user_id = $1 AND project_id = $2", [userId, projectId]).then((r) => r.rows.length > 0);
}

// RTA: list my assigned projects
router.get("/projects", async (req: AuthRequest, res) => {
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  try {
    const sql = isAdmin
      ? "SELECT p.* FROM projects p ORDER BY p.name"
      : "SELECT p.* FROM projects p JOIN rta_projects rp ON rp.project_id = p.id WHERE rp.user_id = $1 ORDER BY p.name";
    const { rows } = await query(sql, isAdmin ? [] : [userId]);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Agents (for scheduler - all agents; filter by project usage on frontend if needed)
router.get("/projects/:projectId/agents", async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  try {
    const allowed = await canAccessProject(req.user!.sub, req.user!.role, projectId);
    if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    const { rows } = await query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email FROM users u
       WHERE u.role = 'agent' AND u.status = 'active'
       ORDER BY u.first_name, u.last_name`
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Schedules for a project in date range (for RTA scheduler view)
router.get("/projects/:projectId/schedules", async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const from = req.query.from as string;
  const to = req.query.to as string;
  if (!from || !to) return res.status(400).json({ error: { message: "from and to (YYYY-MM-DD) required" } });
  try {
    const allowed = await canAccessProject(req.user!.sub, req.user!.role, projectId);
    if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    const { rows } = await query(
      `SELECT s.*, u.first_name, u.last_name, u.email FROM schedules s
       JOIN users u ON u.id = s.user_id
       WHERE s.project_id = $1 AND s.date >= $2 AND s.date <= $3
       ORDER BY s.date, u.first_name`,
      [projectId, from, to]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// RTA: upsert one schedule (login, logout, break times)
router.put("/projects/:projectId/schedules", async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const body = req.body as {
    user_id: string;
    date: string;
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
  if (!body.user_id || !body.date) return res.status(400).json({ error: { message: "user_id and date required" } });
  try {
    const allowed = await canAccessProject(req.user!.sub, req.user!.role, projectId);
    if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    const row = await upsertSchedule({
      userId: body.user_id,
      date: body.date,
      projectId: projectId,
      shiftStart: body.shift_start ?? null,
      shiftEnd: body.shift_end ?? null,
      break1Start: body.break_1_start ?? null,
      break1End: body.break_1_end ?? null,
      break2Start: body.break_2_start ?? null,
      break2End: body.break_2_end ?? null,
      break3Start: body.break_3_start ?? null,
      break3End: body.break_3_end ?? null,
      dayType: body.day_type || "work",
    });
    return res.json(row);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Schedule activities: list (by project + date range or user + date)
router.get("/projects/:projectId/activities", async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const from = req.query.from as string;
  const to = req.query.to as string;
  const userId = req.query.user_id as string | undefined;
  if (!from || !to) return res.status(400).json({ error: { message: "from and to required" } });
  try {
    const allowed = await canAccessProject(req.user!.sub, req.user!.role, projectId);
    if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    let sql = `SELECT a.*, u.first_name, u.last_name FROM schedule_activities a JOIN users u ON u.id = a.user_id WHERE a.activity_date >= $1 AND a.activity_date <= $2 AND (a.project_id = $3 OR a.project_id IS NULL)`;
    const params: any[] = [from, to, projectId];
    if (userId) {
      params.push(userId);
      sql += ` AND a.user_id = $4`;
    }
    sql += ` ORDER BY a.activity_date, a.start_at`;
    const { rows } = await query(sql, params);
    return res.json(rows);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

// Add coaching/meeting (RTA or admin only here; managers use POST /manager/schedule-activities)
router.post("/activities", async (req: AuthRequest, res) => {
  const { user_id, activity_date, project_id, type, start_at, end_at, title, notes } = req.body as {
    user_id?: string;
    activity_date?: string;
    project_id?: string | null;
    type?: string;
    start_at?: string;
    end_at?: string;
    title?: string;
    notes?: string;
  };
  if (!user_id || !activity_date || !type || !start_at || !end_at)
    return res.status(400).json({ error: { message: "user_id, activity_date, type, start_at, end_at required" } });
  if (!["coaching", "meeting", "training"].includes(type))
    return res.status(400).json({ error: { message: "type must be coaching, meeting, or training" } });
  try {
    if (req.user!.role === "rta" && project_id) {
      const allowed = await canAccessProject(req.user!.sub, req.user!.role, project_id);
      if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    }
    const { rows } = await query(
      `INSERT INTO schedule_activities (user_id, activity_date, project_id, type, start_at, end_at, title, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [user_id, activity_date, project_id ?? null, type, start_at, end_at, title ?? null, notes ?? null, req.user!.sub]
    );
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

router.delete("/activities/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const { rows: act } = await query("SELECT project_id FROM schedule_activities WHERE id = $1", [id]);
    if (!act.length) return res.status(404).json({ error: { message: "Not found" } });
    if (req.user!.role === "rta" && act[0].project_id) {
      const allowed = await canAccessProject(req.user!.sub, req.user!.role, act[0].project_id);
      if (!allowed) return res.status(403).json({ error: { message: "Not your project" } });
    }
    if (req.user!.role === "manager") {
      const { rows: a } = await query("SELECT user_id FROM schedule_activities WHERE id = $1", [id]);
      if (a.length) {
        const { rows: u } = await query("SELECT manager_id FROM users WHERE id = $1", [a[0].user_id]);
        if (!u.length || u[0].manager_id !== req.user!.sub) return res.status(403).json({ error: { message: "Not your team" } });
      }
    }
    await query("DELETE FROM schedule_activities WHERE id = $1", [id]);
    return res.json({ message: "Deleted" });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message || "Failed" } });
  }
});

export default router;
